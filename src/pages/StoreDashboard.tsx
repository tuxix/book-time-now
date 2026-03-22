import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Clock, CheckCircle2, Play, Calendar, Settings, LogOut, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

interface Reservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  fee: number;
  profiles: { full_name: string } | null;
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

const statusConfig: Record<string, { bg: string; icon: typeof Clock; next: string }> = {
  scheduled: { bg: "bg-blue-100 text-blue-700", icon: Clock, next: "in_progress" },
  in_progress: { bg: "bg-amber-100 text-amber-700", icon: Play, next: "completed" },
  completed: { bg: "bg-green-100 text-green-700", icon: CheckCircle2, next: "completed" },
};

const StoreDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("reservations");
  const [store, setStore] = useState<StoreData | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("stores")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const s = data as StoreData;
          setStore(s);
          setEditName(s.name);
          setEditDesc(s.description);
          setEditAddr(s.address);
          setEditPhone(s.phone);
          setEditCategory(s.category);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!store) return;
    // Fetch reservations with customer profile via customer_id -> profiles
    supabase
      .from("reservations")
      .select("*, profiles!reservations_customer_id_fkey(full_name)")
      .eq("store_id", store.id)
      .order("reservation_date", { ascending: false })
      .then(({ data }) => {
        if (data) setReservations(data as unknown as Reservation[]);
      });

    supabase
      .from("store_time_slots")
      .select("*")
      .eq("store_id", store.id)
      .order("day_of_week")
      .then(({ data }) => {
        if (data) setSlots(data as TimeSlot[]);
      });
  }, [store]);

  const cycleStatus = async (id: string, current: string) => {
    const next = statusConfig[current]?.next;
    if (!next || next === current) return;
    await supabase.from("reservations").update({ status: next }).eq("id", id);
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: next } : r))
    );
    toast.success(`Status updated to ${next.replace("_", " ")}`);
  };

  const addSlot = async () => {
    if (!store || !slotStart || !slotEnd) return;
    const { data, error } = await supabase
      .from("store_time_slots")
      .insert({ store_id: store.id, day_of_week: parseInt(slotDay), start_time: slotStart, end_time: slotEnd })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setSlots((prev) => [...prev, data as TimeSlot]);
    setSlotDialog(false);
    setSlotStart("");
    setSlotEnd("");
    toast.success("Slot added");
  };

  const removeSlot = async (id: string) => {
    await supabase.from("store_time_slots").delete().eq("id", id);
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const saveProfile = async () => {
    if (!store) return;
    setSaving(true);
    const { error } = await supabase.from("stores").update({
      name: editName,
      description: editDesc,
      address: editAddr,
      phone: editPhone,
      category: editCategory,
    }).eq("id", store.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      setStore({ ...store, name: editName, description: editDesc, address: editAddr, phone: editPhone, category: editCategory });
    }
    setSaving(false);
  };

  const tabs: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: "reservations", label: "Bookings", icon: Calendar },
    { id: "slots", label: "Slots", icon: Clock },
    { id: "profile", label: "Profile", icon: Settings },
  ];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Store Dashboard</p>
            <h1 className="text-lg font-bold text-foreground">{store?.name || "Loading..."}</h1>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Star size={14} className="text-amber-500 fill-amber-500" />
            <span className="font-medium">{store?.rating || 0}</span>
            <span className="text-muted-foreground text-xs">({store?.review_count || 0})</span>
          </div>
        </div>
      </div>

      {/* Reservations */}
      {tab === "reservations" && (
        <div className="px-5 pt-4">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            {reservations.length} reservation{reservations.length !== 1 ? "s" : ""}
          </h2>
          {reservations.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">No reservations yet</p>
          ) : (
            <div className="space-y-3">
              {reservations.map((r, i) => {
                const cfg = statusConfig[r.status] || statusConfig.scheduled;
                const Icon = cfg.icon;
                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-card booka-shadow-sm slide-up"
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{r.profiles?.full_name || "Customer"}</p>
                      <button
                        onClick={() => cycleStatus(r.id, r.status)}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.bg} transition-all active:scale-95`}
                        disabled={r.status === "completed"}
                      >
                        <Icon size={12} /> {r.status.replace("_", " ")}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.reservation_date} · {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Time Slots */}
      {tab === "slots" && (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Time Slots</h2>
            <Button size="sm" variant="outline" className="rounded-xl gap-1 text-xs" onClick={() => setSlotDialog(true)}>
              <Plus size={14} /> Add Slot
            </Button>
          </div>
          {slots.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">No time slots configured</p>
          ) : (
            <div className="space-y-2">
              {slots.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-card booka-shadow-sm">
                  <div>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {DAYS[s.day_of_week]}
                    </span>
                    <span className="text-sm ml-2">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                  </div>
                  <button onClick={() => removeSlot(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 active:scale-95">
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
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="rounded-xl" />
                  <Input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="rounded-xl" />
                </div>
                <Button className="w-full rounded-xl" onClick={addSlot} disabled={!slotStart || !slotEnd}>
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Profile */}
      {tab === "profile" && (
        <div className="px-5 pt-4 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Store Profile</h2>
          <Input placeholder="Store Name" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl" />
          <Input placeholder="Category (e.g. Barber)" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="rounded-xl" />
          <Textarea placeholder="Description" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="rounded-xl resize-none" rows={3} />
          <Input placeholder="Address" value={editAddr} onChange={(e) => setEditAddr(e.target.value)} className="rounded-xl" />
          <Input placeholder="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="rounded-xl" />
          <Button className="w-full rounded-xl" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" className="w-full rounded-xl gap-2 text-destructive" onClick={signOut}>
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      )}

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
                color={tab === t.id ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))"}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: tab === t.id ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))" }}
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
