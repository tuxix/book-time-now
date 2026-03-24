import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Clock, Calendar, Settings, LogOut,
  Plus, Trash2, Store, ArrowLeft, Pencil, RefreshCw, CalendarDays,
  TrendingUp, Star, MessageSquare, Upload, Reply,
} from "lucide-react";
import StoreCalendar from "@/components/StoreCalendar";
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
import { format, startOfWeek, startOfMonth } from "date-fns";
import { CATEGORIES } from "@/lib/categories";
import { timeAgo } from "@/lib/categories";

interface Reservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  fee: number;
  customer_id: string;
  customer_label: string;
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface StoreReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name?: string;
  store_reply?: string;
  store_reply_at?: string;
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
  accepting_bookings?: boolean;
  commitment_fee?: number;
  cancellation_hours?: number;
  announcement?: string;
  avatar_url?: string;
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

// ── Analytics section ─────────────────────────────────────────────────────
const AnalyticsSection = ({
  reservations,
  reviews,
}: {
  reservations: Reservation[];
  reviews: StoreReview[];
}) => {
  const active = reservations.filter((r) => r.status !== "cancelled");
  const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const weekCount = active.filter((r) => r.reservation_date >= weekStart).length;
  const monthCount = active.filter((r) => r.reservation_date >= monthStart).length;

  const dayCounts = DAYS.map((day, d) => ({
    day,
    count: active.filter((r) => new Date(r.reservation_date + "T00:00:00").getDay() === d).length,
  }));
  const busiestDay = dayCounts.reduce((a, b) => (a.count >= b.count ? a : b));
  const maxDayCount = Math.max(...dayCounts.map((d) => d.count), 1);

  const slotCounts = new Map<string, number>();
  active.forEach((r) => {
    const key = r.start_time.slice(0, 5);
    slotCounts.set(key, (slotCounts.get(key) || 0) + 1);
  });
  let popularSlot = "";
  let maxSlotCount = 0;
  slotCounts.forEach((count, slot) => {
    if (count > maxSlotCount) { maxSlotCount = count; popularSlot = slot; }
  });

  const uniqueCustomers = new Set(active.map((r) => r.customer_id)).size;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const StatCard = ({
    label, value, sub,
  }: { label: string; value: string | number; sub?: string }) => (
    <div className="p-3 rounded-2xl bg-card booka-shadow-sm">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="mb-5 space-y-3">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <TrendingUp size={13} /> Analytics
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="This Week" value={weekCount} sub="bookings" />
        <StatCard label="This Month" value={monthCount} sub="bookings" />
        <StatCard label="Busiest Day" value={busiestDay.count > 0 ? busiestDay.day : "—"} sub={busiestDay.count > 0 ? `${busiestDay.count} bookings` : "no data yet"} />
        <StatCard label="Popular Slot" value={popularSlot || "—"} sub={maxSlotCount > 0 ? `${maxSlotCount}× booked` : "no data yet"} />
        <StatCard label="Unique Clients" value={uniqueCustomers} />
        {avgRating && <StatCard label="Avg Rating" value={`★ ${avgRating}`} sub={`${reviews.length} reviews`} />}
      </div>

      {/* Bookings by day of week bar chart */}
      <div className="p-4 rounded-2xl bg-card booka-shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground mb-3">Bookings by Day</p>
        <div className="flex items-end gap-1 h-14">
          {dayCounts.map(({ day, count }) => {
            const h = Math.max(3, Math.round((count / maxDayCount) * 48));
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 48 }}>
                  <div
                    className="w-full rounded-t-sm bg-primary transition-all"
                    style={{ height: h }}
                  />
                </div>
                <span className="text-[8px] text-muted-foreground font-medium">{day.slice(0, 1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Store Setup Screen ────────────────────────────────────────────────────────
const StoreSetupScreen = ({
  initialName, userId, onComplete,
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
    if (!name.trim() || !category.trim()) { toast.error("Store name and category are required."); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .update({ name: name.trim(), category, description: description.trim(), address: address.trim(), phone: phone.trim() })
        .eq("user_id", userId).select().single();
      if (error) throw error;
      if (address.trim()) {
        geocodeAddress(address.trim()).then((coords) => {
          if (coords) supabase.from("stores").update({ latitude: coords.lat, longitude: coords.lng }).eq("user_id", userId);
        });
      }
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
          <p className="text-sm text-muted-foreground">Complete your profile so customers can find and book you.</p>
        </div>
        <form onSubmit={handleSave} className="space-y-4 slide-up">
          <Input data-testid="input-setup-name" placeholder="Store name *" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" required />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category *</p>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.label} type="button" onClick={() => setCategory(cat.label)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all active:scale-95 ${category === cat.label ? "bg-primary text-primary-foreground booka-shadow" : "bg-secondary"}`}>
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[9px] font-bold text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Textarea data-testid="input-setup-description" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl resize-none" rows={3} />
          <Input data-testid="input-setup-address" placeholder="Address (used to place you on the map)" value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl" />
          <Input data-testid="input-setup-phone" placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
          <Button type="submit" className="w-full h-12 rounded-xl font-semibold mt-2" disabled={saving || !name.trim() || !category}>
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
  const [tab, setTab] = useState<"reservations" | "slots" | "profile" | "calendar">("reservations");
  const [store, setStore] = useState<StoreData | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [storeReviews, setStoreReviews] = useState<StoreReview[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [acceptingBookings, setAcceptingBookings] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [commitmentFee, setCommitmentFee] = useState(750);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [announcementText, setAnnouncementText] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [togglingAccepting, setTogglingAccepting] = useState(false);

  // Reply to review
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  // Slot add/edit dialogs
  const [slotDialog, setSlotDialog] = useState(false);
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotDays, setSlotDays] = useState<number[]>([]);
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Load store ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("stores").select("*").eq("user_id", user.id).maybeSingle();
      if (error) { toast.error("Failed to load store data."); setLoadingStore(false); return; }
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
        setAcceptingBookings(s.accepting_bookings !== false);
        setBufferMinutes(s.buffer_minutes ?? 15);
        setCommitmentFee(s.commitment_fee ?? 750);
        setCancellationHours(s.cancellation_hours ?? 24);
        setAnnouncementText(s.announcement || "");
      }
      setLoadingStore(false);
    })();
  }, [user]);

  // ── Fetch reservations, slots, reviews ─────────────────────────────────
  const fetchData = async () => {
    if (!store || needsSetup) return;
    const [resRes, slotsRes, reviewsRes] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, reservation_date, start_time, end_time, status, fee, customer_id")
        .eq("store_id", store.id)
        .order("reservation_date", { ascending: false }),
      supabase
        .from("store_time_slots").select("*").eq("store_id", store.id)
        .order("day_of_week").order("start_time"),
      supabase
        .from("reviews").select("*").eq("store_id", store.id)
        .order("created_at", { ascending: false }),
    ]);
    if (resRes.data) {
      setReservations(resRes.data.map((r, i) => ({ ...r, customer_label: `Customer #${i + 1}` })));
    }
    if (slotsRes.data) setSlots(slotsRes.data as TimeSlot[]);
    if (reviewsRes.data) setStoreReviews(reviewsRes.data as StoreReview[]);
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

  // ── Toggles ──────────────────────────────────────────────────────────────
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

  const toggleAccepting = async () => {
    if (!store || togglingAccepting) return;
    setTogglingAccepting(true);
    const next = !acceptingBookings;
    const { error } = await supabase.from("stores").update({ accepting_bookings: next }).eq("id", store.id);
    if (error) { toast.error("Failed to update booking status."); setTogglingAccepting(false); return; }
    setAcceptingBookings(next);
    setTogglingAccepting(false);
    toast.success(next ? "Now accepting new bookings" : "Bookings paused");
  };

  // ── Auto-save helpers ────────────────────────────────────────────────────
  const saveBufferMinutes = async (val: number) => {
    if (!store) return;
    setBufferMinutes(val);
    await supabase.from("stores").update({ buffer_minutes: val }).eq("id", store.id);
    toast.success("Buffer time saved");
  };

  const saveCommitmentFee = async () => {
    if (!store) return;
    await supabase.from("stores").update({ commitment_fee: commitmentFee }).eq("id", store.id);
    toast.success("Commitment fee saved");
  };

  const saveCancellationHours = async (val: string) => {
    if (!store) return;
    const num = Number(val);
    setCancellationHours(num);
    await supabase.from("stores").update({ cancellation_hours: num }).eq("id", store.id);
    toast.success("Cancellation policy saved");
  };

  const saveAnnouncement = async () => {
    if (!store) return;
    const val = announcementText.slice(0, 100).trim();
    await supabase.from("stores").update({ announcement: val }).eq("id", store.id);
    toast.success("Announcement saved");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${store.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("store-avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast.error(`Upload failed: ${upErr.message}`);
      setAvatarUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("store-avatars").getPublicUrl(path);
    await supabase.from("stores").update({ avatar_url: publicUrl }).eq("id", store.id);
    setStore((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev);
    toast.success("Photo uploaded!");
    setAvatarUploading(false);
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

  // ── Review reply ──────────────────────────────────────────────────────────
  const saveReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setSavingReply(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("reviews").update({
      store_reply: replyText.trim(),
      store_reply_at: now,
    }).eq("id", replyTarget);
    if (error) { toast.error("Could not save reply."); setSavingReply(false); return; }
    setStoreReviews((prev) =>
      prev.map((r) => r.id === replyTarget ? { ...r, store_reply: replyText.trim(), store_reply_at: now } : r)
    );
    setReplyTarget(null);
    setReplyText("");
    setSavingReply(false);
    toast.success("Reply saved");
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

  const Stars = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={11} className={n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-border"} />
      ))}
    </div>
  );

  const navTabs = [
    { id: "reservations" as const, label: "Bookings", icon: Calendar },
    { id: "slots" as const, label: "Slots", icon: Clock },
    { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
    { id: "profile" as const, label: "Profile", icon: Settings },
  ];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-20 flex flex-col">
      {/* ── Dark blue header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 px-5 py-4" style={{ background: "hsl(var(--booka-blue-deep))" }}>
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

      {/* ── Toggles ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-border bg-card space-y-2">
        <button
          data-testid="button-toggle-open"
          onClick={toggleOpen}
          disabled={togglingOpen}
          className={`w-full py-2.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] text-sm ${isOpen ? "bg-green-500" : "bg-red-500"} ${togglingOpen ? "opacity-70" : ""}`}
        >
          <div className="w-2 h-2 rounded-full bg-white" />
          {isOpen ? "Store OPEN" : "Store CLOSED"}
        </button>
        <button
          data-testid="button-toggle-accepting"
          onClick={toggleAccepting}
          disabled={togglingAccepting}
          className={`w-full py-2.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] text-sm ${acceptingBookings ? "bg-blue-500" : "bg-slate-500"} ${togglingAccepting ? "opacity-70" : ""}`}
        >
          <div className="w-2 h-2 rounded-full bg-white" />
          {acceptingBookings ? "Accepting New Bookings" : "Bookings Paused"}
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
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overview</h2>
            <button
              onClick={() => { setRefreshing(true); fetchData(); }}
              className={`p-1.5 rounded-lg hover:bg-secondary ${refreshing ? "animate-spin" : ""}`}
            >
              <RefreshCw size={14} className="text-muted-foreground" />
            </button>
          </div>

          <AnalyticsSection reservations={reservations} reviews={storeReviews} />

          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Today's Bookings</h2>
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
        const DayChips = ({ selected, onToggle }: { selected: number[]; onToggle: (d: number) => void }) => (
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((label, i) => {
              const active = selected.includes(i);
              return (
                <button key={i} type="button" onClick={() => onToggle(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
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
              <Button data-testid="button-add-slot" size="sm" className="rounded-xl gap-1 text-xs h-8"
                onClick={() => { setSlotStart(""); setSlotEnd(""); setSlotDays([]); setSlotDialog(true); }}>
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
                  <div key={`${g.startTime}|${g.endTime}`} data-testid={`card-slot-group-${i}`}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-card booka-shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{fmt12(g.startTime)} – {fmt12(g.endTime)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDays(g.days)}</p>
                    </div>
                    <button onClick={() => openEditGroup(g)} className="p-1.5 rounded-lg hover:bg-secondary active:scale-95 transition-all">
                      <Pencil size={13} className="text-muted-foreground" />
                    </button>
                    <button data-testid={`button-remove-slot-group-${i}`} onClick={() => removeGroupedSlot(g.ids)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 active:scale-95 transition-all">
                      <Trash2 size={13} className="text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add slot dialog */}
            <Dialog open={slotDialog} onOpenChange={(o) => { if (!o) { setSlotDialog(false); setSlotDays([]); } }}>
              <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
                <DialogHeader><DialogTitle>Add Time Slot</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Time Range</p>
                    <div className="flex gap-2">
                      <Input data-testid="input-slot-start" type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="rounded-xl" />
                      <Input data-testid="input-slot-end" type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">Days</p>
                      <button type="button" onClick={() => setSlotDays(slotDays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}
                        className="text-xs font-semibold text-primary">
                        {slotDays.length === 7 ? "Clear All" : "Every Day"}
                      </button>
                    </div>
                    <DayChips selected={slotDays} onToggle={(d) => toggleDay(setSlotDays, d)} />
                  </div>
                  <Button className="w-full rounded-xl" onClick={addSlot} disabled={!slotStart || !slotEnd || slotDays.length === 0}>
                    Save {slotDays.length > 0 ? `(${slotDays.length} day${slotDays.length > 1 ? "s" : ""})` : ""}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit slot dialog */}
            <Dialog open={editGroupIds !== null} onOpenChange={(o) => { if (!o) { setEditGroupIds(null); setEditDays([]); } }}>
              <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
                <DialogHeader><DialogTitle>Edit Time Slot</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Time Range</p>
                    <div className="flex gap-2">
                      <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="rounded-xl" />
                      <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">Days</p>
                      <button type="button" onClick={() => setEditDays(editDays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}
                        className="text-xs font-semibold text-primary">
                        {editDays.length === 7 ? "Clear All" : "Every Day"}
                      </button>
                    </div>
                    <DayChips selected={editDays} onToggle={(d) => { setEditDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]); }} />
                  </div>
                  <Button className="w-full rounded-xl" onClick={saveEditGroup} disabled={!editStart || !editEnd || editDays.length === 0}>
                    Update {editDays.length > 0 ? `(${editDays.length} day${editDays.length > 1 ? "s" : ""})` : ""}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );
      })()}

      {/* ── Calendar tab ──────────────────────────────────────────────────── */}
      {tab === "calendar" && store && (
        <StoreCalendar storeId={store.id} />
      )}

      {/* ── Profile tab ───────────────────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="flex-1 overflow-y-auto px-5 pt-4 space-y-4 pb-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Store Profile</h2>

          {/* Avatar upload */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Profile Photo / Logo</p>
            <div className="flex items-center gap-3">
              {store?.avatar_url ? (
                <img src={store.avatar_url} alt="Store avatar"
                  className="w-14 h-14 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-14 h-14 rounded-xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {store?.name?.slice(0, 2).toUpperCase()}
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                <Upload size={13} />
                {avatarUploading ? "Uploading…" : store?.avatar_url ? "Change Photo" : "Upload Photo"}
              </Button>
            </div>
          </div>

          <Input data-testid="input-profile-name" placeholder="Store name *" value={editName}
            onChange={(e) => setEditName(e.target.value)} className="rounded-xl" />

          {/* Category grid */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.label} type="button" onClick={() => setEditCategory(cat.label)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${editCategory === cat.label ? "bg-primary text-primary-foreground booka-shadow" : "bg-secondary"}`}>
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-[8px] font-bold text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Textarea data-testid="input-profile-description" placeholder="Description" value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)} className="rounded-xl resize-none" rows={3} />
          <Input data-testid="input-profile-address" placeholder="Address (auto-placed on map when saved)"
            value={editAddr} onChange={(e) => setEditAddr(e.target.value)} className="rounded-xl" />
          <Input data-testid="input-profile-phone" placeholder="Phone"
            value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="rounded-xl" />

          {/* Buffer time */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Buffer Time Between Bookings</p>
            <Select value={String(bufferMinutes)} onValueChange={(v) => saveBufferMinutes(Number(v))}>
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
          </div>

          {/* Commitment fee */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Commitment Fee (J$)</p>
            <Input
              data-testid="input-commitment-fee"
              type="number"
              min={0}
              step={50}
              value={commitmentFee}
              onChange={(e) => setCommitmentFee(Number(e.target.value))}
              onBlur={saveCommitmentFee}
              className="rounded-xl"
              placeholder="750"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Shown to customers during booking. Deducted from their final service price.
            </p>
          </div>

          {/* Cancellation window */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Cancellation Window</p>
            <Select value={String(cancellationHours)} onValueChange={saveCancellationHours}>
              <SelectTrigger data-testid="select-cancellation-hours" className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour before</SelectItem>
                <SelectItem value="2">2 hours before</SelectItem>
                <SelectItem value="6">6 hours before</SelectItem>
                <SelectItem value="12">12 hours before</SelectItem>
                <SelectItem value="24">24 hours before</SelectItem>
                <SelectItem value="48">48 hours before</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Customers can cancel for free before this window. Later cancellations forfeit the commitment fee.
            </p>
          </div>

          {/* Announcement */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Announcement</p>
              <span className="text-xs text-muted-foreground">{announcementText.length}/100</span>
            </div>
            <Textarea
              data-testid="input-announcement"
              placeholder="Short message for customers (e.g. Closed for the holidays this week)"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value.slice(0, 100))}
              onBlur={saveAnnouncement}
              className="rounded-xl resize-none"
              rows={2}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Shows as a highlighted banner on your store profile. Leave empty to hide it.
            </p>
          </div>

          <Button data-testid="button-save-profile" className="w-full rounded-xl" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>

          {/* Reviews section */}
          {storeReviews.length > 0 && (
            <div className="pt-4 border-t border-border space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare size={13} /> Customer Reviews
              </h3>
              {storeReviews.map((review) => (
                <div key={review.id} className="p-4 rounded-2xl bg-card booka-shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-foreground">{review.reviewer_name || "Customer"}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-0.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={11} className={n <= Math.round(review.rating) ? "text-amber-400 fill-amber-400" : "text-border"} />
                    ))}
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                  )}
                  {review.store_reply ? (
                    <div className="mt-3 ml-2 pl-3 border-l-2 border-primary/30">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Your Reply</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{review.store_reply}</p>
                      <button
                        onClick={() => { setReplyTarget(review.id); setReplyText(review.store_reply || ""); }}
                        className="text-xs text-primary font-medium mt-1"
                      >
                        Edit reply
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReplyTarget(review.id); setReplyText(""); }}
                      className="mt-2 flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                    >
                      <Reply size={12} /> Reply
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button data-testid="button-sign-out" variant="outline"
            className="w-full rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={signOut}>
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      )}

      {/* ── Bottom nav ────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navTabs.map((t) => (
            <button key={t.id} data-testid={`tab-${t.id}`} onClick={() => setTab(t.id)}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-95">
              <t.icon
                size={22}
                strokeWidth={tab === t.id ? 2.5 : 1.8}
                color={tab === t.id ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))"}
              />
              <span className="text-[10px] font-medium"
                style={{ color: tab === t.id ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))" }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Reply dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!replyTarget} onOpenChange={(o) => { if (!o) { setReplyTarget(null); setReplyText(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Reply to Review</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <Textarea
              placeholder="Write your reply…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="rounded-xl resize-none"
              rows={4}
              autoFocus
            />
            <Button className="w-full rounded-xl" onClick={saveReply} disabled={savingReply || !replyText.trim()}>
              {savingReply ? "Saving…" : "Save Reply"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreDashboard;
