import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Clock, Calendar, Settings, LogOut,
  Plus, Trash2, Store, ArrowLeft, Pencil, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { CATEGORIES } from "@/lib/categories";

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
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
  buffer_minutes: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TODAY = format(new Date(), "yyyy-MM-dd");

const DEFAULT_TIMES: [string, string][] = [
  ["09:00", "10:00"],
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["13:00", "14:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"],
];

const statusConfig: Record<string, { bg: string; label: string; next: string | null }> = {
  scheduled:   { bg: "bg-blue-500 text-white",   label: "Scheduled",   next: "in_progress" },
  in_progress: { bg: "bg-orange-500 text-white", label: "In Progress", next: "completed" },
  completed:   { bg: "bg-green-500 text-white",  label: "Completed",   next: null },
  cancelled:   { bg: "bg-red-400 text-white",    label: "Cancelled",   next: null },
};

async function geocodeAddress(addr: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`
    );
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// ── Store Setup Screen ────────────────────────────────────────────────────────
const StoreSetupScreen = ({
  initialName,
  userId,
  onComplete,
}: {
  initialName: string;
  userId: string;
  onComplete: (store: StoreData, slots: TimeSlot[]) => void;
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
        .update({ name: name.trim(), category, description: description.trim(), address: address.trim(), phone: phone.trim() })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      // Geocode address in background
      if (address.trim()) {
        geocodeAddress(address.trim()).then((coords) => {
          if (coords) {
            supabase.from("stores").update({ latitude: coords.lat, longitude: coords.lng }).eq("user_id", userId);
          }
        });
      }

      // Insert default time slots for all 7 days
      const slotRows: object[] = [];
      for (let day = 0; day <= 6; day++) {
        for (const [start, end] of DEFAULT_TIMES) {
          slotRows.push({ store_id: data.id, day_of_week: day, start_time: start, end_time: end });
        }
      }
      const { data: insertedSlots } = await supabase.from("store_time_slots").insert(slotRows).select();

      toast.success("Store profile saved!");
      onComplete(data as StoreData, (insertedSlots ?? []) as TimeSlot[]);
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
          <h1 className="text-2xl font-bold">Set up your store</h1>
          <p className="text-sm text-muted-foreground">
            Complete your profile so customers can find and book you.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4 slide-up">
          <Input
            data-testid="input-setup-name"
            placeholder="Store name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl"
            required
          />

          {/* Category grid */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category *</p>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setCategory(cat.label)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all active:scale-95 ${
                    category === cat.label
                      ? "bg-primary text-primary-foreground booka-shadow"
                      : "bg-secondary"
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[9px] font-bold text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Textarea
            data-testid="input-setup-description"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl resize-none"
            rows={3}
          />
          <Input
            data-testid="input-setup-address"
            placeholder="Address (used to place you on the map)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-xl"
          />
          <Input
            data-testid="input-setup-phone"
            placeholder="Phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl"
          />

          <Button
            type="submit"
            className="w-full h-12 rounded-xl font-semibold mt-2"
            disabled={saving || !name.trim() || !category}
          >
            {saving ? "Saving…" : "Go to Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const StoreDashboard = ({ onBack }: { onBack: () => void }) => {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<"reservations" | "slots" | "profile">("reservations");
  const [store, setStore] = useState<StoreData | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [togglingOpen, setTogglingOpen] = useState(false);

  // Slot add dialog
  const [slotDialog, setSlotDialog] = useState(false);
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotDays, setSlotDays] = useState<number[]>([]);

  // Slot edit dialog
  const [editGroupIds, setEditGroupIds] = useState<string[] | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDays, setEditDays] = useState<number[]>([]);

  // Profile edit
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAddr, setEditAddr] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // Pull to refresh
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // ── Load store ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("stores").select("*").eq("user_id", user.id).maybeSingle();

      if (error) {
        console.error("[Booka] store load error:", error.message);
        toast.error("Failed to load store data.");
        setLoadingStore(false);
        return;
      }

      if (!data) {
        const name = (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "My Store";
        const { data: newStore, error: cErr } = await supabase
          .from("stores").insert({ user_id: user.id, name }).select().single();
        if (cErr) { toast.error("Could not initialise your store."); setLoadingStore(false); return; }
        setStore(newStore as StoreData);
        setNeedsSetup(true);
      } else {
        const s = data as StoreData;
        setStore(s);
        setNeedsSetup(!s.category?.trim());
        setEditName(s.name || "");
        setEditDesc(s.description || "");
        setEditAddr(s.address || "");
        setEditPhone(s.phone || "");
        setEditCategory(s.category || "");
        setIsOpen(s.is_open !== false);
        setBufferMinutes(s.buffer_minutes ?? 15);
      }
      setLoadingStore(false);
    })();
  }, [user]);

  // ── Fetch reservations & slots ─────────────────────────────────────────
  const fetchData = async () => {
    if (!store || needsSetup) return;
    const [resRes, slotsRes] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, reservation_date, start_time, end_time, status, fee, customer_id")
        .eq("store_id", store.id)
        .order("reservation_date", { ascending: false }),
      supabase
        .from("store_time_slots")
        .select("*")
        .eq("store_id", store.id)
        .order("day_of_week")
        .order("start_time"),
    ]);
    if (resRes.data) {
      setReservations(
        resRes.data.map((r, i) => ({ ...r, customer_label: `Customer #${i + 1}` }))
      );
    }
    if (slotsRes.data) setSlots(slotsRes.data as TimeSlot[]);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, [store, needsSetup]);

  // Pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 70 && el.scrollTop === 0 && !refreshing) { setRefreshing(true); fetchData(); }
  };

  // ── Open / Closed toggle ──────────────────────────────────────────────
  const toggleOpen = async () => {
    if (!store || togglingOpen) return;
    setTogglingOpen(true);
    const next = !isOpen;
    const { error } = await supabase.from("stores").update({ is_open: next }).eq("id", store.id);
    if (error) { toast.error("Failed to update status."); setTogglingOpen(false); return; }
    setIsOpen(next);
    setTogglingOpen(false);
    toast.success(next ? "Store is now OPEN" : "Store is now CLOSED");
  };

  // ── Buffer minutes save ────────────────────────────────────────────────
  const saveBufferMinutes = async (val: number) => {
    if (!store) return;
    setBufferMinutes(val);
    await supabase.from("stores").update({ buffer_minutes: val }).eq("id", store.id);
    toast.success("Buffer time saved");
  };

  // ── Status cycling ─────────────────────────────────────────────────────
  const cycleStatus = async (id: string, current: string) => {
    const next = statusConfig[current]?.next;
    if (!next) return;
    const { error } = await supabase.from("reservations").update({ status: next }).eq("id", id);
    if (error) { toast.error("Failed to update status."); return; }
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    toast.success(`Marked as ${next.replace("_", " ")}`);
  };

  // ── Slot helpers ────────────────────────────────────────────────────────
  interface GroupedSlot { startTime: string; endTime: string; days: number[]; ids: string[]; }

  const groupSlots = (raw: TimeSlot[]): GroupedSlot[] => {
    const map = new Map<string, GroupedSlot>();
    for (const s of raw) {
      const key = `${s.start_time}|${s.end_time}`;
      if (!map.has(key)) map.set(key, { startTime: s.start_time, endTime: s.end_time, days: [], ids: [] });
      const g = map.get(key)!;
      g.days.push(s.day_of_week);
      g.ids.push(s.id);
    }
    const groups = Array.from(map.values());
    groups.forEach((g) => g.days.sort((a, b) => a - b));
    groups.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return groups;
  };

  const formatDays = (days: number[]) => {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 7) return "Every Day";
    return sorted.map((d) => DAYS[d]).join(", ");
  };

  const fmt12 = (t: string) => {
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr);
    const m = mStr;
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
  };

  // ── Slot management ────────────────────────────────────────────────────
  const addSlot = async () => {
    if (!store || !slotStart || !slotEnd || slotDays.length === 0) return;
    if (slotStart >= slotEnd) { toast.error("End time must be after start time."); return; }
    const rows = slotDays.map((day) => ({ store_id: store.id, day_of_week: day, start_time: slotStart, end_time: slotEnd }));
    const { data, error } = await supabase.from("store_time_slots").insert(rows).select();
    if (error) { toast.error(`Failed to add slots: ${error.message}`); return; }
    setSlots((prev) => [...prev, ...(data as TimeSlot[])]);
    setSlotDialog(false); setSlotStart(""); setSlotEnd(""); setSlotDays([]);
    toast.success(`${slotDays.length} slot${slotDays.length > 1 ? "s" : ""} added`);
  };

  const removeGroupedSlot = async (ids: string[]) => {
    const { error } = await supabase.from("store_time_slots").delete().in("id", ids);
    if (error) { toast.error("Failed to remove slots."); return; }
    setSlots((prev) => prev.filter((s) => !ids.includes(s.id)));
    toast.success("Slots removed");
  };

  const openEditGroup = (group: GroupedSlot) => {
    setEditGroupIds(group.ids);
    setEditStart(group.startTime.slice(0, 5));
    setEditEnd(group.endTime.slice(0, 5));
    setEditDays([...group.days]);
  };

  const saveEditGroup = async () => {
    if (!store || !editGroupIds || !editStart || !editEnd || editDays.length === 0) return;
    if (editStart >= editEnd) { toast.error("End time must be after start time."); return; }
    const { error: delErr } = await supabase.from("store_time_slots").delete().in("id", editGroupIds);
    if (delErr) { toast.error("Failed to update slots."); return; }
    const rows = editDays.map((day) => ({ store_id: store.id, day_of_week: day, start_time: editStart, end_time: editEnd }));
    const { data, error } = await supabase.from("store_time_slots").insert(rows).select();
    if (error) { toast.error("Failed to save updated slots."); return; }
    setSlots((prev) => [...prev.filter((s) => !editGroupIds.includes(s.id)), ...(data as TimeSlot[])]);
    setEditGroupIds(null); setEditDays([]);
    toast.success("Slots updated");
  };

  // ── Profile save ───────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!store || !editName.trim()) { toast.error("Store name is required."); return; }
    setSaving(true);
    const updates = {
      name: editName.trim(), description: editDesc.trim(),
      address: editAddr.trim(), phone: editPhone.trim(), category: editCategory,
    };
    const { error } = await supabase.from("stores").update(updates).eq("id", store.id);
    if (error) { toast.error(`Failed to save: ${error.message}`); setSaving(false); return; }
    toast.success("Profile updated");
    setStore({ ...store, ...updates });

    // Geocode address in background
    if (editAddr.trim()) {
      geocodeAddress(editAddr.trim()).then((coords) => {
        if (coords) {
          supabase.from("stores").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", store.id);
          setStore((prev) => prev ? { ...prev, latitude: coords.lat, longitude: coords.lng } : prev);
        }
      });
    }
    setSaving(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (loadingStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (needsSetup && store) {
    return (
      <StoreSetupScreen
        initialName={store.name}
        userId={user!.id}
        onComplete={(updated, defaultSlots) => {
          setStore(updated);
          setEditName(updated.name); setEditDesc(updated.description);
          setEditAddr(updated.address); setEditPhone(updated.phone);
          setEditCategory(updated.category);
          setSlots(defaultSlots);
          setNeedsSetup(false);
        }}
      />
    );
  }

  const todayReservations = reservations.filter((r) => r.reservation_date === TODAY);
  const pastReservations = reservations.filter((r) => r.reservation_date !== TODAY);

  const ReservationCard = ({ r, i }: { r: Reservation; i: number }) => {
    const cfg = statusConfig[r.status] || statusConfig.scheduled;
    const canAdvance = cfg.next !== null;
    return (
      <div
        key={r.id}
        data-testid={`card-reservation-${r.id}`}
        className="p-4 rounded-2xl bg-card booka-shadow-sm slide-up"
        style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-semibold text-sm">{r.customer_label}</p>
          <button
            data-testid={`button-status-${r.id}`}
            onClick={() => cycleStatus(r.id, r.status)}
            disabled={!canAdvance}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all active:scale-95 ${cfg.bg} ${canAdvance ? "cursor-pointer" : "cursor-default opacity-80"}`}
          >
            {cfg.label}
          </button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock size={11} /> {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
          {r.reservation_date !== TODAY && ` · ${r.reservation_date}`}
        </p>
        {canAdvance && (
          <p className="text-[10px] text-muted-foreground mt-1">Tap status to advance →</p>
        )}
      </div>
    );
  };

  const navTabs = [
    { id: "reservations" as const, label: "Bookings", icon: Calendar },
    { id: "slots" as const, label: "Slots", icon: Clock },
    { id: "profile" as const, label: "Profile", icon: Settings },
  ];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-20 flex flex-col">
      {/* ── Dark blue header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-5 py-4"
        style={{ background: "hsl(var(--booka-blue-deep))" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70 font-medium">Business Dashboard</p>
            <h1 className="text-lg font-bold text-white">{store?.name || "My Store"}</h1>
            <p className="text-xs text-white/60 mt-0.5">{format(new Date(), "EEEE, MMM d")}</p>
          </div>
          <button
            data-testid="button-back-to-app"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-semibold active:scale-95 transition-all"
          >
            <ArrowLeft size={14} /> Back to App
          </button>
        </div>
      </div>

      {/* ── Open / Closed toggle ─────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-border bg-card">
        <button
          data-testid="button-toggle-open"
          onClick={toggleOpen}
          disabled={togglingOpen}
          className={`w-full py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] ${
            isOpen ? "bg-green-500" : "bg-red-500"
          } ${togglingOpen ? "opacity-70" : ""}`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
          {isOpen ? "OPEN — Accepting Bookings" : "CLOSED — Not Accepting Bookings"}
        </button>
      </div>

      {/* ── Reservations tab ─────────────────────────────────────────────── */}
      {tab === "reservations" && (
        <div
          ref={scrollRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto px-5 pt-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Bookings</h2>
            <button
              onClick={() => { setRefreshing(true); fetchData(); }}
              className={`p-1.5 rounded-lg hover:bg-secondary ${refreshing ? "animate-spin" : ""}`}
            >
              <RefreshCw size={14} className="text-muted-foreground" />
            </button>
          </div>

          {todayReservations.length === 0 ? (
            <div className="p-4 rounded-2xl bg-secondary text-center mb-5">
              <p className="text-sm text-muted-foreground">No bookings today</p>
            </div>
          ) : (
            <div className="space-y-3 mb-5">
              {todayReservations.map((r, i) => <ReservationCard key={r.id} r={r} i={i} />)}
            </div>
          )}

          {pastReservations.length > 0 && (
            <>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">All Bookings</h2>
              <div className="space-y-3">
                {pastReservations.map((r, i) => <ReservationCard key={r.id} r={r} i={i} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Slots tab ─────────────────────────────────────────────────────── */}
      {tab === "slots" && (() => {
        const grouped = groupSlots(slots);
        const DayChips = ({
          selected, onToggle,
        }: { selected: number[]; onToggle: (d: number) => void }) => (
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((label, i) => {
              const active = selected.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onToggle(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );
        const toggleDay = (setter: (fn: (prev: number[]) => number[]) => void, d: number) => {
          setter((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
        };
        return (
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Time Slots</h2>
              <Button
                data-testid="button-add-slot"
                size="sm"
                className="rounded-xl gap-1 text-xs h-8"
                onClick={() => { setSlotStart(""); setSlotEnd(""); setSlotDays([]); setSlotDialog(true); }}
              >
                <Plus size={13} /> Add
              </Button>
            </div>

            {grouped.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No time slots configured</p>
                <p className="text-xs mt-1 opacity-70">Tap + Add to create your first time slot</p>
              </div>
            ) : (
              <div className="space-y-2">
                {grouped.map((g, i) => (
                  <div
                    key={`${g.startTime}|${g.endTime}`}
                    data-testid={`card-slot-group-${i}`}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-card booka-shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {fmt12(g.startTime)} – {fmt12(g.endTime)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDays(g.days)}</p>
                    </div>
                    <button
                      onClick={() => openEditGroup(g)}
                      className="p-1.5 rounded-lg hover:bg-secondary active:scale-95 transition-all"
                    >
                      <Pencil size={13} className="text-muted-foreground" />
                    </button>
                    <button
                      data-testid={`button-remove-slot-group-${i}`}
                      onClick={() => removeGroupedSlot(g.ids)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 active:scale-95 transition-all"
                    >
                      <Trash2 size={13} className="text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Add slot dialog ── */}
            <Dialog open={slotDialog} onOpenChange={(o) => { if (!o) { setSlotDialog(false); setSlotDays([]); } }}>
              <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
                <DialogHeader><DialogTitle>Add Time Slot</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Time Range</p>
                    <div className="flex gap-2">
                      <Input
                        data-testid="input-slot-start"
                        type="time"
                        value={slotStart}
                        onChange={(e) => setSlotStart(e.target.value)}
                        className="rounded-xl"
                      />
                      <Input
                        data-testid="input-slot-end"
                        type="time"
                        value={slotEnd}
                        onChange={(e) => setSlotEnd(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">Days</p>
                      <button
                        type="button"
                        onClick={() => setSlotDays(slotDays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}
                        className="text-xs font-semibold text-primary"
                      >
                        {slotDays.length === 7 ? "Clear All" : "Every Day"}
                      </button>
                    </div>
                    <DayChips selected={slotDays} onToggle={(d) => toggleDay(setSlotDays, d)} />
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    onClick={addSlot}
                    disabled={!slotStart || !slotEnd || slotDays.length === 0}
                  >
                    Save {slotDays.length > 0 ? `(${slotDays.length} day${slotDays.length > 1 ? "s" : ""})` : ""}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Edit slot dialog ── */}
            <Dialog open={editGroupIds !== null} onOpenChange={(o) => { if (!o) { setEditGroupIds(null); setEditDays([]); } }}>
              <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
                <DialogHeader><DialogTitle>Edit Time Slot</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Time Range</p>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="rounded-xl"
                      />
                      <Input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">Days</p>
                      <button
                        type="button"
                        onClick={() => setEditDays(editDays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}
                        className="text-xs font-semibold text-primary"
                      >
                        {editDays.length === 7 ? "Clear All" : "Every Day"}
                      </button>
                    </div>
                    <DayChips selected={editDays} onToggle={(d) => toggleDay(setEditDays, d)} />
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    onClick={saveEditGroup}
                    disabled={!editStart || !editEnd || editDays.length === 0}
                  >
                    Update {editDays.length > 0 ? `(${editDays.length} day${editDays.length > 1 ? "s" : ""})` : ""}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );
      })()}

      {/* ── Profile tab ───────────────────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="flex-1 overflow-y-auto px-5 pt-4 space-y-3 pb-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Store Profile</h2>
          <Input
            data-testid="input-profile-name"
            placeholder="Store name *"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="rounded-xl"
          />

          {/* Category grid */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setEditCategory(cat.label)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${
                    editCategory === cat.label
                      ? "bg-primary text-primary-foreground booka-shadow"
                      : "bg-secondary"
                  }`}
                >
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-[8px] font-bold text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Textarea
            data-testid="input-profile-description"
            placeholder="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="rounded-xl resize-none"
            rows={3}
          />
          <Input
            data-testid="input-profile-address"
            placeholder="Address (auto-placed on map when saved)"
            value={editAddr}
            onChange={(e) => setEditAddr(e.target.value)}
            className="rounded-xl"
          />
          <Input
            data-testid="input-profile-phone"
            placeholder="Phone"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className="rounded-xl"
          />

          {/* Buffer time */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Buffer Time Between Bookings</p>
            <Select
              value={String(bufferMinutes)}
              onValueChange={(v) => saveBufferMinutes(Number(v))}
            >
              <SelectTrigger data-testid="select-buffer-minutes" className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 minutes — no buffer</SelectItem>
                <SelectItem value="15">15 minutes — default</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Buffer time gives you breathing room between appointments so a running-over session does not affect the next client.
            </p>
          </div>

          <Button
            data-testid="button-save-profile"
            className="w-full rounded-xl"
            onClick={saveProfile}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>

          <Button
            data-testid="button-sign-out"
            variant="outline"
            className="w-full rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={signOut}
          >
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      )}

      {/* ── Bottom nav ────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navTabs.map((t) => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
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
