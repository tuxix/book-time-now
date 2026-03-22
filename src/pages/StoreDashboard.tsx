import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Clock,
  CheckCircle2,
  Play,
  Calendar,
  Settings,
  LogOut,
  Plus,
  Trash2,
  Star,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Reservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  fee: number;
  customer_label: string;
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface StoreData {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  category: string;
  rating: number;
  review_count: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "reservations" | "slots" | "profile";

const statusConfig: Record<
  string,
  { bg: string; icon: typeof Clock; next: string | null }
> = {
  scheduled: { bg: "bg-blue-100 text-blue-700", icon: Clock, next: "in_progress" },
  in_progress: { bg: "bg-amber-100 text-amber-700", icon: Play, next: "completed" },
  completed: { bg: "bg-green-100 text-green-700", icon: CheckCircle2, next: null },
  cancelled: { bg: "bg-red-100 text-red-700", icon: Clock, next: null },
};

// ─── Store Setup Screen (shown on first login if store profile is incomplete) ───
const StoreSetupScreen = ({
  initialName,
  userId,
  onComplete,
}: {
  initialName: string;
  userId: string;
  onComplete: (store: StoreData) => void;
}) => {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category.trim()) {
      toast.error("Store name and category are required.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .update({
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          address: address.trim(),
          phone: phone.trim(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      toast.success("Store profile saved!");
      onComplete(data as StoreData);
    } catch (err: any) {
      toast.error(err.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2 fade-in">
          <div className="w-14 h-14 rounded-2xl booka-gradient flex items-center justify-center mx-auto mb-3">
            <Store size={28} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set up your store</h1>
          <p className="text-sm text-muted-foreground">
            Complete your profile so customers can find and book you.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-3 slide-up">
          <Input
            placeholder="Store name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl"
            required
          />
          <Input
            placeholder="Category — e.g. Barber, Salon, Spa *"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl"
            required
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl resize-none"
            rows={3}
          />
          <Input
            placeholder="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-xl"
          />
          <Input
            placeholder="Phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl"
          />
          <Button
            type="submit"
            className="w-full h-12 rounded-xl font-semibold mt-2"
            disabled={saving || !name.trim() || !category.trim()}
          >
            {saving ? "Saving..." : "Go to Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const StoreDashboard = () => {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("reservations");
  const [store, setStore] = useState<StoreData | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Slot dialog
  const [slotDialog, setSlotDialog] = useState(false);
  const [slotDay, setSlotDay] = useState("1");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");

  // Profile edit
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAddr, setEditAddr] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // Load store — create if missing (handles email-confirmation signup edge case)
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load store data. Please refresh.");
        setLoadingStore(false);
        return;
      }

      if (!data) {
        // Store record was not created at signup (e.g. email confirmation was required).
        // Create it now that the user is authenticated.
        const name =
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "My Store";
        const { data: newStore, error: createError } = await supabase
          .from("stores")
          .insert({ user_id: user.id, name })
          .select()
          .single();

        if (createError) {
          toast.error("Could not initialize your store. Please refresh.");
          setLoadingStore(false);
          return;
        }
        setStore(newStore as StoreData);
        setNeedsSetup(true);
      } else {
        const s = data as StoreData;
        setStore(s);
        // Show setup if store has no category yet
        setNeedsSetup(!s.category?.trim());
        setEditName(s.name || "");
        setEditDesc(s.description || "");
        setEditAddr(s.address || "");
        setEditPhone(s.phone || "");
        setEditCategory(s.category || "");
      }

      setLoadingStore(false);
    })();
  }, [user]);

  // Fetch reservations & slots once store is known
  useEffect(() => {
    if (!store || needsSetup) return;

    // Reservations — label each with a customer identifier
    supabase
      .from("reservations")
      .select("id, reservation_date, start_time, end_time, status, fee, customer_id")
      .eq("store_id", store.id)
      .order("reservation_date", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setReservations(
          data.map((r, i) => ({
            ...r,
            customer_label: `Customer #${i + 1}`,
          }))
        );
      });

    // Time slots
    supabase
      .from("store_time_slots")
      .select("*")
      .eq("store_id", store.id)
      .order("day_of_week")
      .then(({ data }) => {
        if (data) setSlots(data as TimeSlot[]);
      });
  }, [store, needsSetup]);

  const cycleStatus = async (id: string, current: string) => {
    const cfg = statusConfig[current];
    if (!cfg?.next) return;
    const { error } = await supabase
      .from("reservations")
      .update({ status: cfg.next })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update status.");
      return;
    }
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: cfg.next! } : r))
    );
    toast.success(`Marked as ${cfg.next.replace("_", " ")}`);
  };

  const addSlot = async () => {
    if (!store || !slotStart || !slotEnd) return;
    if (slotStart >= slotEnd) {
      toast.error("End time must be after start time.");
      return;
    }
    const { data, error } = await supabase
      .from("store_time_slots")
      .insert({
        store_id: store.id,
        day_of_week: parseInt(slotDay),
        start_time: slotStart,
        end_time: slotEnd,
      })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add slot.");
      return;
    }
    setSlots((prev) => [...prev, data as TimeSlot]);
    setSlotDialog(false);
    setSlotStart("");
    setSlotEnd("");
    toast.success("Slot added");
  };

  const removeSlot = async (id: string) => {
    const { error } = await supabase.from("store_time_slots").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove slot.");
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const saveProfile = async () => {
    if (!store) return;
    if (!editName.trim()) {
      toast.error("Store name is required.");
      return;
    }
    setSaving(true);
    const updates = {
      name: editName.trim(),
      description: editDesc.trim(),
      address: editAddr.trim(),
      phone: editPhone.trim(),
      category: editCategory.trim(),
    };
    const { error } = await supabase
      .from("stores")
      .update(updates)
      .eq("id", store.id);
    if (error) {
      toast.error("Failed to save. Please try again.");
    } else {
      toast.success("Profile updated");
      setStore({ ...store, ...updates });
    }
    setSaving(false);
  };

  const tabs: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: "reservations", label: "Bookings", icon: Calendar },
    { id: "slots", label: "Slots", icon: Clock },
    { id: "profile", label: "Profile", icon: Settings },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── First-run setup ────────────────────────────────────────────────────────
  if (needsSetup && store) {
    return (
      <StoreSetupScreen
        initialName={store.name}
        userId={user!.id}
        onComplete={(updatedStore) => {
          setStore(updatedStore);
          setEditName(updatedStore.name);
          setEditDesc(updatedStore.description);
          setEditAddr(updatedStore.address);
          setEditPhone(updatedStore.phone);
          setEditCategory(updatedStore.category);
          setNeedsSetup(false);
        }}
      />
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Store Dashboard</p>
            <h1 className="text-lg font-bold text-foreground">
              {store?.name || "My Store"}
            </h1>
          </div>
          {store && store.review_count > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star size={14} className="text-amber-500 fill-amber-500" />
              <span className="font-medium">{store.rating}</span>
              <span className="text-muted-foreground text-xs">
                ({store.review_count})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Reservations tab */}
      {tab === "reservations" && (
        <div className="px-5 pt-4">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            {reservations.length}{" "}
            {reservations.length === 1 ? "reservation" : "reservations"}
          </h2>
          {reservations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No reservations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r, i) => {
                const cfg = statusConfig[r.status] || statusConfig.scheduled;
                const Icon = cfg.icon;
                const canAdvance = cfg.next !== null;
                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-card booka-shadow-sm slide-up"
                    style={{
                      animationDelay: `${i * 60}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{r.customer_label}</p>
                      <button
                        onClick={() => cycleStatus(r.id, r.status)}
                        disabled={!canAdvance}
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all active:scale-95 ${cfg.bg} ${canAdvance ? "cursor-pointer" : "cursor-default opacity-70"}`}
                      >
                        <Icon size={12} />
                        {r.status.replace("_", " ")}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.reservation_date} · {r.start_time.slice(0, 5)} –{" "}
                      {r.end_time.slice(0, 5)}
                    </p>
                    {canAdvance && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Tap status to advance →{" "}
                        {cfg.next!.replace("_", " ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Slots tab */}
      {tab === "slots" && (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Time Slots
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1 text-xs"
              onClick={() => setSlotDialog(true)}
            >
              <Plus size={14} /> Add Slot
            </Button>
          </div>

          {slots.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No time slots configured</p>
              <button
                onClick={() => setSlotDialog(true)}
                className="mt-2 text-xs text-primary font-semibold hover:underline"
              >
                Add your first slot
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-card booka-shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {DAYS[s.day_of_week]}
                    </span>
                    <span className="text-sm">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeSlot(s.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 active:scale-95 transition-all"
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Dialog open={slotDialog} onOpenChange={setSlotDialog}>
            <DialogContent className="max-w-xs rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add Time Slot</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Select value={slotDay} onValueChange={setSlotDay}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className="rounded-xl"
                  />
                  <Input
                    type="time"
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <Button
                  className="w-full rounded-xl"
                  onClick={addSlot}
                  disabled={!slotStart || !slotEnd}
                >
                  Save Slot
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Profile tab */}
      {tab === "profile" && (
        <div className="px-5 pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Store Profile
          </h2>
          <Input
            placeholder="Store name *"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="rounded-xl"
          />
          <Input
            placeholder="Category (e.g. Barber, Salon)"
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            className="rounded-xl"
          />
          <Textarea
            placeholder="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="rounded-xl resize-none"
            rows={3}
          />
          <Input
            placeholder="Address"
            value={editAddr}
            onChange={(e) => setEditAddr(e.target.value)}
            className="rounded-xl"
          />
          <Input
            placeholder="Phone"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className="rounded-xl"
          />
          <Button
            className="w-full rounded-xl"
            onClick={saveProfile}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={signOut}
          >
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border booka-shadow-lg">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
            >
              <t.icon
                size={22}
                strokeWidth={tab === t.id ? 2.5 : 1.8}
                color={
                  tab === t.id
                    ? "hsl(var(--booka-blue))"
                    : "hsl(var(--booka-text-secondary))"
                }
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color:
                    tab === t.id
                      ? "hsl(var(--booka-blue))"
                      : "hsl(var(--booka-text-secondary))",
                }}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default StoreDashboard;
