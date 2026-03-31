import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  Clock, Calendar, Settings, LogOut,
  Plus, Trash2, Store, ArrowLeft, ArrowRight, Pencil, RefreshCw, CalendarDays,
  TrendingUp, Star, MessageSquare, Upload, Reply, Package, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Receipt, Phone, User, Sun, Moon, Bell, X as XIcon,
  Image, ImagePlus, CheckCircle2, Crown, Zap, Lock, AlertCircle, Menu as MenuIcon, UserPlus,
} from "lucide-react";
import ReceiptDialog, { type ReservationServiceData } from "@/components/ReceiptDialog";
import ChatScreen from "@/components/ChatScreen";
import StoreMessagesTab from "@/components/StoreMessagesTab";
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
import { CATEGORIES, DAILY_LIMITS, DEFAULT_SERVICES, CATEGORY_DURATIONS } from "@/lib/categories";
import { timeAgo } from "@/lib/categories";

interface Reservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  fee: number;
  payment_status?: string;
  total_amount?: number;
  refund_amount?: number;
  retained_amount?: number;
  commitment_fee_amount?: number;
  customer_id: string;
  customer_label: string;
  customer_name?: string;
  customer_phone?: string;
  checkin_code?: string;
  cancelled_by?: string;
  is_walk_in?: boolean;
  walk_in_name?: string | null;
  reservation_services?: ReservationServiceData[];
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  capacity: number;
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
  categories?: string[];
  rating: number;
  review_count: number;
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
  buffer_minutes: number;
  accepting_bookings?: boolean;
  cancellation_hours?: number;
  announcement?: string;
  avatar_url?: string;
  subscription_tier?: "free" | "pro" | "premium";
  category_locked_until?: string | null;
  primary_category?: string | null;
  onboarding_completed?: boolean;
}

interface ServiceOptionItem {
  id: string;
  group_id: string;
  label: string;
  price_modifier: number;
  sort_order: number;
}

interface ServiceOptionGroup {
  id: string;
  service_id: string;
  label: string;
  selection_type: "single" | "multi";
  required: boolean;
  sort_order: number;
  service_option_items: ServiceOptionItem[];
}

interface StoreService {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  base_price: number;
  sort_order: number;
  is_active: boolean;
  duration_minutes?: number | null;
  service_option_groups: ServiceOptionGroup[];
}

interface StoreHour {
  id?: string;
  store_id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

interface StoreBreak {
  id?: string;
  store_id: string;
  day_of_week: number;
  break_start: string;
  break_end: string;
  label?: string;
}

interface StorePhoto {
  id: string;
  store_id: string;
  image_url: string;
  caption: string | null;
  is_cover: boolean;
  display_order: number;
  created_at: string;
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

const statusConfig: Record<string, { bg: string; label: string; next: string | null; prev: string | null }> = {
  scheduled:   { bg: "bg-blue-500 text-white",    label: "Scheduled",   next: "arrived",     prev: null },
  arrived:     { bg: "bg-purple-500 text-white",  label: "Arrived",     next: "in_progress", prev: "scheduled" },
  in_progress: { bg: "bg-orange-500 text-white",  label: "In Progress", next: "completed",   prev: "arrived" },
  completed:   { bg: "bg-green-500 text-white",   label: "Completed",   next: null,          prev: "in_progress" },
  cancelled:   { bg: "bg-red-400 text-white",     label: "Cancelled",   next: null,          prev: null },
  no_show:     { bg: "bg-slate-500 text-white",   label: "No Show",     next: null,          prev: null },
};

const PAST_STATUSES = new Set(["completed", "cancelled", "no_show"]);

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
    <div className="p-3.5 rounded-2xl bg-card booka-shadow-sm border border-border/50 flex flex-col gap-1">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-extrabold text-foreground leading-none">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
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
        <div className="flex items-end gap-1.5 h-14">
          {dayCounts.map(({ day, count }) => {
            const h = Math.max(4, Math.round((count / maxDayCount) * 48));
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 48 }}>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: h,
                      background: `linear-gradient(to top, hsl(var(--booka-blue)), hsl(var(--booka-blue-glow)))`,
                    }}
                  />
                </div>
                <span className="text-[8px] text-muted-foreground font-semibold">{day.slice(0, 1)}</span>
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleSetupCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedCategories.length === 0) { toast.error("Store name and at least one category are required."); return; }
    const primaryCategory = selectedCategories[0];
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .update({ name: name.trim(), category: primaryCategory, categories: selectedCategories, description: description.trim(), address: address.trim(), phone: phone.trim() })
        .eq("user_id", userId).select().single();
      if (error) throw error;
      if (address.trim()) {
        geocodeAddress(address.trim()).then((coords) => {
          if (coords) supabase.from("stores").update({ latitude: coords.lat, longitude: coords.lng }).eq("user_id", userId);
        });
      }
      // Create default store_hours (Mon–Fri 9am–5pm, Sat 9am–2pm, Sun closed)
      const hourRows = [0,1,2,3,4,5,6].map((d) => ({
        store_id: data.id, day_of_week: d,
        is_open: d >= 1 && d <= 6,
        open_time: "09:00",
        close_time: d === 6 ? "14:00" : "17:00",
      }));
      await supabase.from("store_hours").insert(hourRows);

      // Create default services based on primary category
      const defaultSvcs = DEFAULT_SERVICES[primaryCategory] ?? [];
      if (defaultSvcs.length > 0) {
        const svcRows = defaultSvcs.slice(0, 3).map((s, i) => ({
          store_id: data.id, name: s.name, base_price: s.price, sort_order: i, is_active: true,
          duration_minutes: s.duration,
        }));
        await supabase.from("store_services").insert(svcRows);
      }

      const slotRows: { store_id: string; day_of_week: number; start_time: string; end_time: string; capacity: number }[] = [];
      for (let day = 0; day <= 6; day++) {
        for (const [start, end] of DEFAULT_TIMES) {
          slotRows.push({ store_id: data.id, day_of_week: day, start_time: start, end_time: end, capacity: 1 });
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Categories * <span className="font-normal normal-case">(select all that apply)</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.label} type="button" onClick={() => toggleSetupCategory(cat.label)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all active:scale-95 ${selectedCategories.includes(cat.label) ? "bg-primary text-primary-foreground booka-shadow" : "bg-secondary"}`}>
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[9px] font-bold text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
            {selectedCategories.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Primary: <strong>{selectedCategories[0]}</strong>
                {selectedCategories.length > 1 && ` · +${selectedCategories.length - 1} more`}
              </p>
            )}
          </div>
          <Textarea data-testid="input-setup-description" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl resize-none" rows={3} />
          <Input data-testid="input-setup-address" placeholder="Address (used to place you on the map)" value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl" />
          <Input data-testid="input-setup-phone" placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
          <Button type="submit" className="w-full h-12 rounded-xl font-semibold mt-2" disabled={saving || !name.trim() || selectedCategories.length === 0}>
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
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<"reservations" | "slots" | "hours" | "profile" | "calendar" | "services" | "reviews" | "messages" | "photos">("reservations");
  const [storeUnreadMsgCount, setStoreUnreadMsgCount] = useState(0);
  const [storeAnnouncement, setStoreAnnouncement] = useState<{ id: string; title: string; message: string } | null>(null);
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
  const [cancellationHours, setCancellationHours] = useState(24);
  const [announcementText, setAnnouncementText] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [togglingAccepting, setTogglingAccepting] = useState(false);

  // Chat / messaging — routes to Messages tab instead of floating overlay
  const [pendingChat, setPendingChat] = useState<{ reservationId: string; customerName: string } | null>(null);
  const [storeChatTarget, setStoreChatTarget] = useState<{ reservationId: string; customerName: string } | null>(null);
  const [storeMessagesRefreshTrigger, setStoreMessagesRefreshTrigger] = useState(0);

  // Reply to review
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  // Slot add/edit dialogs
  const [slotDialog, setSlotDialog] = useState(false);
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotDays, setSlotDays] = useState<number[]>([]);
  const [slotCapacity, setSlotCapacity] = useState(1);
  const [editGroupIds, setEditGroupIds] = useState<string[] | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editCapacity, setEditCapacity] = useState(1);

  // Profile edit
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAddr, setEditAddr] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Receipt
  const [receiptTarget, setReceiptTarget] = useState<Reservation | null>(null);

  // Past bookings collapsed/expanded
  const [showPast, setShowPast] = useState(false);

  // Code entry dialog (arrived → in_progress)
  const [codeDialog, setCodeDialog] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);

  // Cancel for customer
  const [cancelForCustomerDialog, setCancelForCustomerDialog] = useState<string | null>(null);
  const [cancellingForCustomer, setCancellingForCustomer] = useState(false);

  // No Show confirmation
  const [noShowDialog, setNoShowDialog] = useState<string | null>(null);
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);

  // Subscription page
  const [showSubscription, setShowSubscription] = useState(false);

  // Photos tab
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoUploadDialog, setPhotoUploadDialog] = useState(false);
  const [photoFullscreen, setPhotoFullscreen] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);

  // Ticks every minute so countdown labels + no-show button auto-update
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Hours tab
  const [storeHours, setStoreHours] = useState<StoreHour[]>([]);
  const [storeBreaks, setStoreBreaks] = useState<StoreBreak[]>([]);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [breakDialog, setBreakDialog] = useState<number | null>(null);
  const [newBreakStart, setNewBreakStart] = useState("12:00");
  const [newBreakEnd, setNewBreakEnd] = useState("13:00");
  const [newBreakLabel, setNewBreakLabel] = useState("Lunch");

  // Late-night surcharge (Pro/Premium)
  const [lateNightStart, setLateNightStart] = useState((store as any)?.late_night_start ?? "");
  const [lateNightSurcharge, setLateNightSurcharge] = useState(String((store as any)?.late_night_surcharge ?? "0"));

  // Services (Menu) tab
  const [storeServices, setStoreServices] = useState<StoreService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcDesc, setNewSvcDesc] = useState("");
  const [newSvcPrice, setNewSvcPrice] = useState("0");
  const [newSvcDuration, setNewSvcDuration] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [groupDialog, setGroupDialog] = useState<string | null>(null);
  const [newGrpLabel, setNewGrpLabel] = useState("");
  const [newGrpType, setNewGrpType] = useState<"single" | "multi">("single");
  const [newGrpRequired, setNewGrpRequired] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [itemDialog, setItemDialog] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("0");
  const [savingItem, setSavingItem] = useState(false);

  // Edit service dialog
  const [editSvcDialog, setEditSvcDialog] = useState(false);
  const [editSvcTarget, setEditSvcTarget] = useState<StoreService | null>(null);
  const [editSvcName, setEditSvcName] = useState("");
  const [editSvcDesc, setEditSvcDesc] = useState("");
  const [editSvcPrice, setEditSvcPrice] = useState("0");
  const [editSvcDuration, setEditSvcDuration] = useState("");
  const [editSvcActive, setEditSvcActive] = useState(true);
  const [savingEditSvc, setSavingEditSvc] = useState(false);

  // Walk-in system
  const [walkInDialog, setWalkInDialog] = useState(false);
  const [walkInDate, setWalkInDate] = useState(TODAY);
  const [walkInSlots, setWalkInSlots] = useState<TimeSlot[]>([]);
  const [walkInTakenIds, setWalkInTakenIds] = useState<Set<string>>(new Set());
  const [walkInSlotId, setWalkInSlotId] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [walkInLoading, setWalkInLoading] = useState(false);
  const [savingWalkIn, setSavingWalkIn] = useState(false);

  // Category-change confirmation dialog
  const [pendingCategoryChange, setPendingCategoryChange] = useState(false);

  // Hamburger drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Tier-derived limits (always computed from live store state) ──────────
  const storeTier: "free" | "pro" | "premium" = store?.subscription_tier ?? "free";
  const tierCatLimit   = storeTier === "premium" ? Infinity : storeTier === "pro" ? 3 : 1;
  const tierSvcLimit   = storeTier === "free" ? 3 : Infinity;
  const tierPhotoLimit = storeTier === "premium" ? Infinity : storeTier === "pro" ? 20 : 5;
  const tierCapLimit   = storeTier === "free" ? 1 : Infinity;

  // ── Category lock ─────────────────────────────────────────────────────────
  const lockUntil = store?.category_locked_until ? new Date(store.category_locked_until) : null;
  const isCategoryLocked = !!(lockUntil && lockUntil > new Date() && store?.category?.trim());
  const daysUntilUnlock  = lockUntil ? Math.ceil((lockUntil.getTime() - Date.now()) / 86400000) : 0;
  const lockDateStr      = lockUntil ? format(lockUntil, "MMM d, yyyy") : "";

  // ── Today's booking count (free-tier warning banner) ──────────────────────
  const [todayBookingCount, setTodayBookingCount] = useState(0);

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
        setEditCategories(
          s.categories && s.categories.length > 0 ? s.categories : (s.category ? [s.category] : [])
        );
        setIsOpen(s.is_open !== false);
        setAcceptingBookings(s.accepting_bookings !== false);
        setBufferMinutes(s.buffer_minutes ?? 15);
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
        .select("id, reservation_date, start_time, end_time, status, fee, payment_status, total_amount, refund_amount, retained_amount, commitment_fee_amount, customer_id, checkin_code, cancelled_by, is_walk_in, walk_in_name, reservation_services(*)")
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
      const reservationData = resRes.data;
      const customerIds = [...new Set(reservationData.map((r) => r.customer_id as string))];
      const { data: profilesData } = customerIds.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", customerIds)
        : { data: [] };
      const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
      setReservations(
        reservationData.map((r, i) => {
          const isWalkIn = !!(r as any).is_walk_in;
          const walkInName = (r as any).walk_in_name as string | null;
          const profile = isWalkIn ? null : profileMap.get(r.customer_id as string);
          return {
            ...r,
            customer_label: isWalkIn ? (walkInName || "Walk-in Customer") : (profile?.full_name || `Customer #${i + 1}`),
            customer_name: isWalkIn ? (walkInName || "Walk-in Customer") : (profile?.full_name ?? undefined),
            customer_phone: isWalkIn ? undefined : (profile?.phone ?? undefined),
          } as unknown as Reservation;
        })
      );
    }
    if (slotsRes.data) setSlots(slotsRes.data as TimeSlot[]);
    if (reviewsRes.data) setStoreReviews(reviewsRes.data as StoreReview[]);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, [store, needsSetup]);

  // ── Fetch today's booking count (for free-tier daily limit banner) ────────
  useEffect(() => {
    if (!store?.id || storeTier !== "free") return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("reservation_date", todayStr)
      .neq("status", "cancelled")
      .then(({ count }) => setTodayBookingCount(count ?? 0));
  }, [store?.id, storeTier]);

  // ── Realtime subscription: pick up customer check-ins and status changes ─
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel(`store-reservations-${store.id}`)
      .on("postgres_changes" as any, {
        event: "UPDATE", schema: "public", table: "reservations",
        filter: `store_id=eq.${store.id}`,
      }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store]);

  // ── Global unread message listener — keeps badge updated on all tabs ───
  useEffect(() => {
    if (!store) return;
    const fetchStoreUnread = async () => {
      const { data: resData } = await supabase
        .from("reservations").select("id").eq("store_id", store.id);
      if (!resData || resData.length === 0) { setStoreUnreadMsgCount(0); return; }
      const resIds = resData.map((r) => r.id);
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .in("reservation_id", resIds)
        .eq("sender_role", "customer")
        .eq("read", false);
      setStoreUnreadMsgCount(count ?? 0);
    };
    fetchStoreUnread();
    const channel = supabase
      .channel(`store-unread-msgs-${store.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "messages" }, fetchStoreUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store]);

  // ── Announcements for store owners ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchAnn = async () => {
      const dismissed: string[] = (() => { try { return JSON.parse(localStorage.getItem("booka_dismissed_ann") ?? "[]"); } catch { return []; } })();
      const { data } = await supabase.from("announcements").select("id, title, message").in("audience", ["all", "stores"]).order("created_at", { ascending: false }).limit(10);
      if (data) {
        const next = data.find((a: any) => !dismissed.includes(a.id));
        setStoreAnnouncement(next ?? null);
      }
    };
    fetchAnn();
    const ch = supabase.channel("ann-store").on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "announcements" }, fetchAnn).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // ── Fetch services ───────────────────────────────────────────────────────
  const fetchServices = async () => {
    if (!store) return;
    setLoadingServices(true);
    const { data } = await supabase
      .from("store_services")
      .select("*, service_option_groups(*, service_option_items(*))")
      .eq("store_id", store.id)
      .neq("is_archived", true)
      .order("sort_order");
    if (data) setStoreServices(data as StoreService[]);
    setLoadingServices(false);
  };

  useEffect(() => { if (tab === "services" && store) fetchServices(); }, [tab, store]);

  // ── Fetch / save store hours ─────────────────────────────────────────────
  const fetchStoreHours = async () => {
    if (!store) return;
    setHoursLoading(true);
    const [hoursRes, breaksRes] = await Promise.all([
      supabase.from("store_hours").select("*").eq("store_id", store.id).order("day_of_week"),
      supabase.from("store_breaks").select("*").eq("store_id", store.id).order("day_of_week"),
    ]);
    if (hoursRes.data) {
      const loaded = hoursRes.data as StoreHour[];
      // Ensure all 7 days exist
      const full: StoreHour[] = [0,1,2,3,4,5,6].map((d) => {
        const existing = loaded.find((h) => h.day_of_week === d);
        return existing ?? { store_id: store.id, day_of_week: d, is_open: d >= 1 && d <= 5, open_time: "09:00", close_time: "17:00" };
      });
      setStoreHours(full);
    } else {
      setStoreHours([0,1,2,3,4,5,6].map((d) => ({ store_id: store.id, day_of_week: d, is_open: d >= 1 && d <= 5, open_time: "09:00", close_time: "17:00" })));
    }
    if (breaksRes.data) setStoreBreaks(breaksRes.data as StoreBreak[]);
    setHoursLoading(false);
  };

  const saveAllHours = async () => {
    if (!store) return;
    setSavingHours(true);
    for (const hour of storeHours) {
      if (hour.id) {
        await supabase.from("store_hours").update({ is_open: hour.is_open, open_time: hour.open_time, close_time: hour.close_time }).eq("id", hour.id);
      } else {
        const { data } = await supabase.from("store_hours").insert({ store_id: store.id, day_of_week: hour.day_of_week, is_open: hour.is_open, open_time: hour.open_time, close_time: hour.close_time }).select().single();
        if (data) setStoreHours((prev) => prev.map((h) => h.day_of_week === hour.day_of_week ? { ...h, id: (data as any).id } : h));
      }
    }
    setSavingHours(false);
    toast.success("Hours saved");
  };

  const addBreak = async (dayOfWeek: number) => {
    if (!store) return;
    const { data, error } = await supabase.from("store_breaks").insert({ store_id: store.id, day_of_week: dayOfWeek, break_start: newBreakStart, break_end: newBreakEnd, label: newBreakLabel.trim() || null }).select().single();
    if (error) { toast.error("Could not add break"); return; }
    setStoreBreaks((prev) => [...prev, data as StoreBreak]);
    setBreakDialog(null);
    setNewBreakStart("12:00"); setNewBreakEnd("13:00"); setNewBreakLabel("Lunch");
    toast.success("Break added");
  };

  const deleteBreak = async (breakId: string) => {
    await supabase.from("store_breaks").delete().eq("id", breakId);
    setStoreBreaks((prev) => prev.filter((b) => b.id !== breakId));
  };

  const saveLateNight = async () => {
    if (!store) return;
    await supabase.from("stores").update({ late_night_start: lateNightStart || null, late_night_surcharge: parseFloat(lateNightSurcharge) || 0 }).eq("id", store.id);
    toast.success("Late-night surcharge saved");
  };

  useEffect(() => { if (tab === "hours" && store) fetchStoreHours(); }, [tab, store]);

  // ── Photos CRUD ──────────────────────────────────────────────────────────
  const fetchPhotos = async () => {
    if (!store) return;
    setPhotosLoading(true);
    const { data } = await supabase
      .from("store_photos")
      .select("*")
      .eq("store_id", store.id)
      .order("display_order");
    if (data) setPhotos(data as StorePhoto[]);
    setPhotosLoading(false);
  };

  useEffect(() => { if (tab === "photos" && store) fetchPhotos(); }, [tab, store]);

  const selectPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPhotoFile(file);
    setPendingPhotoPreview(URL.createObjectURL(file));
    setPhotoUploadDialog(true);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const uploadPhoto = async () => {
    if (!store || !pendingPhotoFile || !user) return;
    if (photos.length >= tierPhotoLimit) {
      toast.error(`Photo limit reached (${tierPhotoLimit === Infinity ? "∞" : tierPhotoLimit} on ${storeTier} plan)`);
      return;
    }
    setUploadingPhoto(true);
    const ext = pendingPhotoFile.name.split(".").pop() ?? "jpg";
    const path = `${store.id}/${Date.now()}.${ext}`;
    const { error: storageErr } = await supabase.storage.from("store-photos").upload(path, pendingPhotoFile, { upsert: true });
    if (storageErr) { toast.error("Upload failed"); setUploadingPhoto(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("store-photos").getPublicUrl(path);
    const isCover = photos.length === 0;
    const { error: dbErr } = await supabase.from("store_photos").insert({
      store_id: store.id,
      image_url: publicUrl,
      caption: photoCaption.trim() || null,
      is_cover: isCover,
      display_order: photos.length,
    });
    setUploadingPhoto(false);
    if (dbErr) { toast.error("Could not save photo"); return; }
    toast.success("Photo uploaded!");
    setPhotoUploadDialog(false);
    setPhotoCaption("");
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    fetchPhotos();
  };

  const deletePhoto = async (photo: StorePhoto) => {
    const pathPart = photo.image_url.split("/store-photos/")[1];
    if (pathPart) await supabase.storage.from("store-photos").remove([pathPart]);
    await supabase.from("store_photos").delete().eq("id", photo.id);
    const remaining = photos.filter((p) => p.id !== photo.id);
    if (photo.is_cover && remaining.length > 0) {
      await supabase.from("store_photos").update({ is_cover: true }).eq("id", remaining[0].id);
    }
    toast.success("Photo deleted");
    fetchPhotos();
  };

  const setCoverPhoto = async (photo: StorePhoto) => {
    await supabase.from("store_photos").update({ is_cover: false }).eq("store_id", store!.id);
    await supabase.from("store_photos").update({ is_cover: true }).eq("id", photo.id);
    fetchPhotos();
  };

  const movePhoto = async (photo: StorePhoto, direction: "up" | "down") => {
    const idx = photos.findIndex((p) => p.id === photo.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= photos.length) return;
    const swap = photos[swapIdx];
    await Promise.all([
      supabase.from("store_photos").update({ display_order: swap.display_order }).eq("id", photo.id),
      supabase.from("store_photos").update({ display_order: photo.display_order }).eq("id", swap.id),
    ]);
    fetchPhotos();
  };

  // ── Service CRUD ─────────────────────────────────────────────────────────
  const addService = async () => {
    if (!store || !newSvcName.trim()) return;
    setSavingService(true);
    const { data, error } = await supabase
      .from("store_services")
      .insert({ store_id: store.id, name: newSvcName.trim(), description: newSvcDesc.trim() || null, base_price: parseFloat(newSvcPrice) || 0, sort_order: storeServices.length, duration_minutes: newSvcDuration ? parseInt(newSvcDuration) : null })
      .select("*, service_option_groups(*, service_option_items(*))")
      .single();
    setSavingService(false);
    if (error) { toast.error("Could not add service."); return; }
    setStoreServices((prev) => [...prev, data as StoreService]);
    setServiceDialog(false);
    setNewSvcName(""); setNewSvcDesc(""); setNewSvcPrice("0"); setNewSvcDuration("");
    toast.success("Service added!");
  };

  const deleteService = async (id: string) => {
    const { error } = await supabase.from("store_services").delete().eq("id", id);
    if (error) { console.error("deleteService RLS error:", error); toast.error("Could not remove service."); return; }
    setStoreServices((prev) => prev.filter((s) => s.id !== id));
    toast.success("Service removed.");
  };

  const toggleServiceActive = async (svc: StoreService) => {
    await supabase.from("store_services").update({ is_active: !svc.is_active }).eq("id", svc.id);
    setStoreServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, is_active: !s.is_active } : s));
  };

  const openEditSvc = (svc: StoreService) => {
    setEditSvcTarget(svc);
    setEditSvcName(svc.name);
    setEditSvcDesc(svc.description ?? "");
    setEditSvcPrice(String(svc.base_price));
    setEditSvcDuration(String(svc.duration_minutes ?? ""));
    setEditSvcActive(svc.is_active);
    setEditSvcDialog(true);
  };

  const saveEditService = async () => {
    if (!editSvcTarget || !editSvcName.trim()) return;
    setSavingEditSvc(true);
    const updates = {
      name: editSvcName.trim(),
      description: editSvcDesc.trim() || null,
      base_price: parseFloat(editSvcPrice) || 0,
      duration_minutes: editSvcDuration ? parseInt(editSvcDuration) : null,
      is_active: editSvcActive,
    };
    const { error } = await supabase.from("store_services").update(updates).eq("id", editSvcTarget.id);
    setSavingEditSvc(false);
    if (error) { toast.error("Could not save changes."); return; }
    setStoreServices((prev) => prev.map((s) => s.id === editSvcTarget.id ? { ...s, ...updates } : s));
    setEditSvcDialog(false);
    setEditSvcTarget(null);
    toast.success("Service updated!");
  };

  const applyDefaultServicesForCategory = async (storeId: string, newCategory: string, tier: "free" | "pro" | "premium") => {
    // Fetch current service IDs fresh from DB
    const { data: existing, error: selErr } = await supabase.from("store_services").select("id").eq("store_id", storeId);
    if (selErr) console.error("applyDefaultServices select error:", selErr);
    if (existing && existing.length > 0) {
      const ids = existing.map((s) => s.id);
      // Find which services are referenced in past bookings — those can't be hard-deleted
      const { data: referenced } = await supabase.from("reservation_service_selections").select("service_id").in("service_id", ids);
      const referencedSet = new Set((referenced ?? []).map((r) => r.service_id));
      const deletableIds = ids.filter((id) => !referencedSet.has(id));
      const lockedIds = ids.filter((id) => referencedSet.has(id));
      // Hard delete services with no booking history
      if (deletableIds.length > 0) {
        const { error: delErr } = await supabase.from("store_services").delete().in("id", deletableIds);
        if (delErr) console.error("applyDefaultServices delete error:", delErr);
      }
      // Archive services tied to past bookings — hidden from menu, preserved for booking history
      if (lockedIds.length > 0) {
        await supabase.from("store_services").update({ is_archived: true }).in("id", lockedIds);
      }
    }
    // Insert new defaults for the new category
    const defaults = DEFAULT_SERVICES[newCategory] ?? [];
    if (defaults.length === 0) return;
    const svcLimit = tier === "free" ? 3 : Infinity;
    const rows = defaults.map((d, i) => ({
      store_id: storeId,
      name: d.name,
      base_price: d.price,
      duration_minutes: d.duration,
      sort_order: i,
      is_active: tier === "free" ? i < svcLimit : true,
    }));
    await supabase.from("store_services").insert(rows);
  };

  const addGroup = async (serviceId: string) => {
    if (!newGrpLabel.trim()) return;
    setSavingGroup(true);
    const svc = storeServices.find((s) => s.id === serviceId);
    const { data, error } = await supabase
      .from("service_option_groups")
      .insert({ service_id: serviceId, label: newGrpLabel.trim(), selection_type: newGrpType, required: newGrpRequired, sort_order: svc?.service_option_groups.length ?? 0 })
      .select("*, service_option_items(*)")
      .single();
    setSavingGroup(false);
    if (error) { toast.error("Could not add group."); return; }
    setStoreServices((prev) => prev.map((s) => s.id === serviceId ? { ...s, service_option_groups: [...s.service_option_groups, data as ServiceOptionGroup] } : s));
    setGroupDialog(null);
    setNewGrpLabel(""); setNewGrpType("single"); setNewGrpRequired(true);
  };

  const deleteGroup = async (serviceId: string, groupId: string) => {
    await supabase.from("service_option_groups").delete().eq("id", groupId);
    setStoreServices((prev) => prev.map((s) => s.id === serviceId ? { ...s, service_option_groups: s.service_option_groups.filter((g) => g.id !== groupId) } : s));
  };

  const addItem = async (groupId: string, serviceId: string) => {
    if (!newItemLabel.trim()) return;
    setSavingItem(true);
    const svc = storeServices.find((s) => s.id === serviceId);
    const grp = svc?.service_option_groups.find((g) => g.id === groupId);
    const { data, error } = await supabase
      .from("service_option_items")
      .insert({ group_id: groupId, label: newItemLabel.trim(), price_modifier: parseFloat(newItemPrice) || 0, sort_order: grp?.service_option_items.length ?? 0 })
      .select()
      .single();
    setSavingItem(false);
    if (error) { toast.error("Could not add option."); return; }
    setStoreServices((prev) => prev.map((s) => s.id === serviceId ? {
      ...s,
      service_option_groups: s.service_option_groups.map((g) => g.id === groupId ? { ...g, service_option_items: [...g.service_option_items, data as ServiceOptionItem] } : g),
    } : s));
    setItemDialog(null);
    setNewItemLabel(""); setNewItemPrice("0");
  };

  const deleteItem = async (serviceId: string, groupId: string, itemId: string) => {
    await supabase.from("service_option_items").delete().eq("id", itemId);
    setStoreServices((prev) => prev.map((s) => s.id === serviceId ? {
      ...s,
      service_option_groups: s.service_option_groups.map((g) => g.id === groupId ? { ...g, service_option_items: g.service_option_items.filter((i) => i.id !== itemId) } : g),
    } : s));
  };

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
    const path = `${user!.id}/avatar.${ext}`;
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

  const revertStatus = async (id: string, current: string) => {
    const prev = statusConfig[current]?.prev;
    if (!prev) return;
    const { error } = await supabase.from("reservations").update({ status: prev }).eq("id", id);
    if (error) { toast.error("Failed to revert status."); return; }
    setReservations((rs) => rs.map((r) => (r.id === id ? { ...r, status: prev } : r)));
    toast.success(`Reverted to ${prev.replace("_", " ")}`);
  };

  const markNoShow = async (id: string) => {
    setConfirmingNoShow(true);
    const reservation = reservations.find((r) => r.id === id);
    const totalAmount = reservation?.total_amount ?? 750;
    const retainedAmount = reservation?.commitment_fee_amount ?? Math.round(totalAmount * 0.25);
    const refundAmount = Math.max(0, totalAmount - retainedAmount);
    const { error } = await supabase
      .from("reservations")
      .update({
        status: "no_show",
        payment_status: "partially_refunded",
        retained_amount: retainedAmount,
        refund_amount: refundAmount,
      })
      .eq("id", id);
    setConfirmingNoShow(false);
    setNoShowDialog(null);
    if (error) { toast.error(`Failed to mark no show: ${error.message}`); return; }
    setReservations((rs) => rs.map((r) => r.id === id ? {
      ...r,
      status: "no_show",
      payment_status: "partially_refunded",
      retained_amount: retainedAmount,
      refund_amount: refundAmount,
    } : r));
    const fmt = (p: number) => `J$${Number(p).toFixed(0)}`;
    toast.success(`No Show marked — ${fmt(retainedAmount)} retained, ${fmt(refundAmount)} to be refunded.`);
  };

  const handleCodeSubmit = async () => {
    if (!codeDialog || codeInput.length !== 4) return;
    setCodeSubmitting(true);
    setCodeError("");
    // Always fetch the latest checkin_code from DB to avoid stale local state
    const { data: fresh, error: fetchErr } = await supabase
      .from("reservations")
      .select("checkin_code")
      .eq("id", codeDialog)
      .single();
    if (fetchErr || !fresh) {
      setCodeError("Could not verify code. Please try again.");
      setCodeSubmitting(false);
      return;
    }
    const storedCode = (fresh.checkin_code ?? "").trim();
    const enteredCode = codeInput.trim();
    if (storedCode !== enteredCode) {
      setCodeError("Incorrect code — please try again.");
      setCodeSubmitting(false);
      return;
    }
    const { error } = await supabase.from("reservations").update({ status: "in_progress" }).eq("id", codeDialog);
    setCodeSubmitting(false);
    if (error) { toast.error("Failed to update status."); return; }
    setReservations((prev) => prev.map((r) => r.id === codeDialog ? { ...r, status: "in_progress" } : r));
    setCodeDialog(null);
    setCodeInput("");
    toast.success("Code verified — marked as In Progress!");
  };

  const handleCancelForCustomer = async () => {
    if (!cancelForCustomerDialog) return;
    setCancellingForCustomer(true);
    const reservation = reservations.find((r) => r.id === cancelForCustomerDialog);
    const totalAmount = reservation?.total_amount ?? 750;
    const { error } = await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        cancelled_by: "store",
        payment_status: "refunded",
        refund_amount: totalAmount,
        retained_amount: 0,
      })
      .eq("id", cancelForCustomerDialog);
    setCancellingForCustomer(false);
    if (error) { toast.error("Failed to cancel."); return; }
    setReservations((prev) => prev.map((r) => r.id === cancelForCustomerDialog ? {
      ...r,
      status: "cancelled",
      cancelled_by: "store",
      payment_status: "refunded",
      refund_amount: totalAmount,
      retained_amount: 0,
    } : r));
    setCancelForCustomerDialog(null);
    toast.success("Appointment cancelled — full refund will be processed for the customer.");
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

  // ── Walk-in helpers ──────────────────────────────────────────────────────
  const fetchWalkInSlots = async (dateStr: string) => {
    if (!store) return;
    setWalkInLoading(true);
    setWalkInSlotId(null);
    const toMins = (t: string) => { const [h, m] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
    const toTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();
    const [hoursRes, breaksRes, existingRes] = await Promise.all([
      supabase.from("store_hours").select("*").eq("store_id", store.id),
      supabase.from("store_breaks").select("*").eq("store_id", store.id),
      supabase.from("reservations").select("start_time, end_time, service_duration_minutes").eq("store_id", store.id).eq("reservation_date", dateStr).neq("status", "cancelled"),
    ]);
    const hours = (hoursRes.data ?? []) as StoreHour[];
    const breaks = (breaksRes.data ?? []) as StoreBreak[];
    const bookings = (existingRes.data ?? []) as { start_time: string; end_time: string; service_duration_minutes?: number | null }[];
    let availableSlots: TimeSlot[] = [];
    if (hours.length > 0) {
      const todayHour = hours.find((h) => h.day_of_week === dayOfWeek);
      if (todayHour && todayHour.is_open) {
        const openMins = toMins(todayHour.open_time);
        const closeMins = toMins(todayHour.close_time);
        const dayBreaks = breaks.filter((b) => b.day_of_week === dayOfWeek);
        let cur = openMins;
        while (cur + 60 <= closeMins) {
          const slotEnd = cur + 60;
          const overlapsBreak = dayBreaks.some((b) => cur < toMins(b.break_end) && slotEnd > toMins(b.break_start));
          if (!overlapsBreak) {
            availableSlots.push({ id: `gen-${cur}`, day_of_week: dayOfWeek, start_time: toTime(cur), end_time: toTime(slotEnd), is_available: true, capacity: 1 });
          }
          cur += 60;
        }
      }
    } else {
      const { data: manualSlots } = await supabase.from("store_time_slots").select("*").eq("store_id", store.id).eq("day_of_week", dayOfWeek).eq("is_available", true).order("start_time");
      availableSlots = (manualSlots ?? []) as TimeSlot[];
    }
    const buffer = store.buffer_minutes ?? 15;
    const taken = new Set<string>();
    availableSlots.forEach((slot) => {
      const slotStart = toMins(slot.start_time);
      const slotEnd = toMins(slot.end_time);
      const cap = slot.capacity ?? 1;
      const exactCount = bookings.filter((b) => b.start_time.slice(0, 5) === slot.start_time.slice(0, 5) && b.end_time.slice(0, 5) === slot.end_time.slice(0, 5)).length;
      if (exactCount >= cap) {
        taken.add(slot.id);
      } else {
        for (const b of bookings) {
          const effectiveDuration = b.service_duration_minutes != null ? b.service_duration_minutes : (toMins(b.end_time) - toMins(b.start_time));
          const bookingEnd = toMins(b.start_time) + effectiveDuration + buffer;
          if (slotStart < bookingEnd && slotEnd > toMins(b.start_time) && !(b.start_time.slice(0, 5) === slot.start_time.slice(0, 5) && b.end_time.slice(0, 5) === slot.end_time.slice(0, 5))) {
            taken.add(slot.id);
            break;
          }
        }
      }
    });
    setWalkInSlots(availableSlots);
    setWalkInTakenIds(taken);
    setWalkInLoading(false);
  };

  const createWalkIn = async () => {
    if (!store || !walkInSlotId || !user) return;
    const slot = walkInSlots.find((s) => s.id === walkInSlotId);
    if (!slot) return;
    setSavingWalkIn(true);
    if (storeTier === "free") {
      const primaryCategory = store.categories?.[0] ?? store.category;
      const dailyLimit = DAILY_LIMITS[primaryCategory] ?? 0;
      if (dailyLimit > 0) {
        const { count } = await supabase.from("reservations").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("reservation_date", walkInDate).neq("status", "cancelled");
        if ((count ?? 0) >= dailyLimit) {
          toast.error("Daily booking limit reached. Cannot add more walk-ins.");
          setSavingWalkIn(false);
          return;
        }
      }
    }
    const { error } = await supabase.from("reservations").insert({
      customer_id: user.id,
      store_id: store.id,
      reservation_date: walkInDate,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: "in_progress",
      total_amount: 0,
      commitment_fee_amount: 0,
      payment_status: "waived",
      is_walk_in: true,
      walk_in_name: walkInName.trim() || "Walk-in Customer",
    });
    setSavingWalkIn(false);
    if (error) { toast.error("Could not create walk-in booking."); return; }
    toast.success(`Walk-in added${walkInName.trim() ? ` for ${walkInName.trim()}` : ""}!`);
    setWalkInDialog(false);
    setWalkInName("");
    setWalkInSlotId(null);
    setWalkInDate(TODAY);
    fetchData();
  };

  // ── Slot helpers ────────────────────────────────────────────────────────
  interface GroupedSlot { startTime: string; endTime: string; days: number[]; ids: string[]; capacity: number; }

  const groupSlots = (raw: TimeSlot[]): GroupedSlot[] => {
    const map = new Map<string, GroupedSlot>();
    for (const s of raw) {
      const cap = s.capacity ?? 1;
      const key = `${s.start_time}|${s.end_time}|${cap}`;
      if (!map.has(key)) map.set(key, { startTime: s.start_time, endTime: s.end_time, days: [], ids: [], capacity: cap });
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
    const rows = slotDays.map((day) => ({ store_id: store.id, day_of_week: day, start_time: slotStart, end_time: slotEnd, capacity: slotCapacity }));
    const { data, error } = await supabase.from("store_time_slots").insert(rows).select();
    if (error) { toast.error(`Failed to add slots: ${error.message}`); return; }
    setSlots((prev) => [...prev, ...(data as TimeSlot[])]);
    setSlotDialog(false); setSlotStart(""); setSlotEnd(""); setSlotDays([]); setSlotCapacity(1);
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
    setEditCapacity(group.capacity);
  };

  const saveEditGroup = async () => {
    if (!store || !editGroupIds || !editStart || !editEnd || editDays.length === 0) return;
    if (editStart >= editEnd) { toast.error("End time must be after start time."); return; }
    const { error: delErr } = await supabase.from("store_time_slots").delete().in("id", editGroupIds);
    if (delErr) { toast.error("Failed to update slots."); return; }
    const rows = editDays.map((day) => ({ store_id: store.id, day_of_week: day, start_time: editStart, end_time: editEnd, capacity: editCapacity }));
    const { data, error } = await supabase.from("store_time_slots").insert(rows).select();
    if (error) { toast.error("Failed to save updated slots."); return; }
    setSlots((prev) => [...prev.filter((s) => !editGroupIds.includes(s.id)), ...(data as TimeSlot[])]);
    setEditGroupIds(null); setEditDays([]); setEditCapacity(1);
    toast.success("Slots updated");
  };

  // ── Profile save ───────────────────────────────────────────────────────
  const saveProfile = async (confirmed = false) => {
    if (!store || !editName.trim()) { toast.error("Store name is required."); return; }
    if (editCategories.length === 0) { toast.error("Please select at least one category."); return; }
    // Hard tier enforcement at save time — catches any UI bypass
    if (editCategories.length > tierCatLimit) {
      const excess = editCategories.length - tierCatLimit;
      toast.error(
        `Your ${storeTier} plan allows ${tierCatLimit === Infinity ? "unlimited" : tierCatLimit} categor${tierCatLimit === 1 ? "y" : "ies"}. Please remove ${excess} more.`
      );
      setShowSubscription(true);
      return;
    }
    const primaryCategory = editCategories[0];
    const isPrimaryChanging = primaryCategory !== (store.category ?? "");
    // Hard guard: block primary category change if locked
    if (isPrimaryChanging && store.category?.trim() && isCategoryLocked) {
      toast.error(`Primary category locked until ${lockDateStr}. Unlocks in ${daysUntilUnlock} day${daysUntilUnlock !== 1 ? "s" : ""}.`);
      return;
    }
    // Show confirmation before changing primary category
    if (isPrimaryChanging && store.category?.trim() && !confirmed) {
      setPendingCategoryChange(true);
      return;
    }
    setSaving(true);
    const newLockUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const setPrimaryLock = isPrimaryChanging || !store.category?.trim();
    const updates: Record<string, unknown> = {
      name: editName.trim(), description: editDesc.trim(),
      address: editAddr.trim(), phone: editPhone.trim(),
      category: primaryCategory, categories: editCategories,
      ...(setPrimaryLock && {
        primary_category: primaryCategory,
        category_locked_until: newLockUntil,
      }),
    };
    const { error } = await supabase.from("stores").update(updates).eq("id", store.id);
    if (error) { toast.error(`Failed to save: ${error.message}`); setSaving(false); return; }
    toast.success("Profile updated");
    setStore({ ...store, ...updates } as StoreData);
    setEditCategory(primaryCategory);
    if (isPrimaryChanging && store.id) {
      await applyDefaultServicesForCategory(store.id, primaryCategory, storeTier);
      await fetchServices();
    }
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

  const todayActive = reservations
    .filter((r) => r.reservation_date === TODAY && !PAST_STATUSES.has(r.status))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const upcomingReservations = reservations
    .filter((r) => r.reservation_date > TODAY && !PAST_STATUSES.has(r.status))
    .sort((a, b) => a.reservation_date.localeCompare(b.reservation_date) || a.start_time.localeCompare(b.start_time));

  const pastReservations = reservations
    .filter((r) => PAST_STATUSES.has(r.status))
    .sort((a, b) => b.reservation_date.localeCompare(a.reservation_date) || b.start_time.localeCompare(a.start_time));

  const ReservationCard = ({ r, i }: { r: Reservation; i: number }) => {
    const cfg = statusConfig[r.status] || statusConfig.scheduled;
    const isArrived = r.status === "arrived";
    const isPast = PAST_STATUSES.has(r.status);
    const isCancelled = r.status === "cancelled";
    const canRevert = cfg.prev !== null && !isPast;
    const canAdvanceDirect = cfg.next !== null && !isArrived && !isPast;
    const isCancelledByStore = isCancelled && r.cancelled_by === "store";
    const isCancelledByCustomer = isCancelled && r.cancelled_by !== "store";
    const badgeLabel = isCancelledByStore ? "Cancelled by Store" : isCancelledByCustomer ? "Cancelled by Customer" : cfg.label;
    const isToday = r.reservation_date === TODAY;
    const canCancelForCustomer = isToday && (r.status === "scheduled" || r.status === "arrived");

    // No Show: today + scheduled + ≥30 min past start time.
    // start_time from DB is "HH:MM:SS" in Jamaica local time (UTC-5, no DST).
    // Append the Jamaica UTC offset so comparison with nowTick (a real UTC Date) is correct.
    const apptStartDate = new Date(`${r.reservation_date}T${r.start_time}-05:00`);
    const noShowThreshold = new Date(apptStartDate.getTime() + 30 * 60_000);
    const minsElapsed = (nowTick.getTime() - apptStartDate.getTime()) / 60_000;
    const canNoShow = isToday && r.status === "scheduled" && minsElapsed >= 30;
    const showNoShowCountdown = isToday && r.status === "scheduled"
      && minsElapsed > 0 && minsElapsed < 30;
    const minsUntilNoShow = showNoShowCountdown
      ? Math.ceil(30 - minsElapsed)
      : 0;

    const svc = r.reservation_services?.[0] ?? null;
    const total = r.total_amount ?? (svc ? svc.subtotal : 750);
    const depositAmt = r.commitment_fee_amount ?? Math.round(total * 0.25);
    const fmt = (p: number) => `J$${Number(p).toFixed(0)}`;
    const displayName = r.customer_name || r.customer_label || "Customer";
    const initials = displayName.slice(0, 2).toUpperCase();

    const Divider = () => <div className="border-t border-border/60" />;
    const SectionLabel = ({ label }: { label: string }) => (
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
    );

    return (
      <div
        data-testid={`card-reservation-${r.id}`}
        className={`rounded-2xl bg-card booka-shadow-sm slide-up overflow-hidden ${isPast ? "opacity-80" : ""}`}
        style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
      >
        <div className="p-4 space-y-3">

          {/* Row 1: Avatar + name + status badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{displayName}</p>
              {r.is_walk_in && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 inline-block mt-0.5">Walk-in</span>
              )}
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${cfg.bg} ${(r.status === "scheduled" || r.status === "arrived") ? "pulse-badge" : ""}`}>
              {badgeLabel}
            </span>
          </div>

          {/* Row 2: Phone */}
          {r.customer_phone ? (
            <a
              href={`tel:${r.customer_phone}`}
              data-testid={`link-phone-${r.id}`}
              className="flex items-center gap-2 text-xs text-primary font-medium hover:underline active:scale-95 transition-all"
            >
              <Phone size={12} className="shrink-0" />
              {r.customer_phone}
            </a>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground italic">
              <Phone size={12} className="shrink-0 opacity-40" />
              No phone on file
            </p>
          )}

          <Divider />

          {/* APPOINTMENT */}
          <div className="space-y-1.5">
            <SectionLabel label="Appointment" />
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Calendar size={13} className="text-muted-foreground shrink-0" />
              {r.reservation_date === TODAY ? "Today" : format(new Date(r.reservation_date + "T12:00:00"), "EEE, MMM d")}
              &nbsp;·&nbsp;
              {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
            </p>
          </div>

          <Divider />

          {/* SERVICE */}
          <div className="space-y-1.5">
            <SectionLabel label="Service" />
            {svc ? (
              <>
                <p className="text-sm font-bold text-foreground">{svc.service_name}</p>
                {(svc.selected_options as any[]).map((opt, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground pl-2">
                    {opt.group_label}: {opt.item_label}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">No service selected</p>
            )}
          </div>

          <Divider />

          {/* PRICE BREAKDOWN */}
          <div className="space-y-1.5">
            <SectionLabel label="Price Breakdown" />
            {svc ? (
              <>
                <div className="flex justify-between text-xs text-foreground">
                  <span>{svc.service_name}</span>
                  <span>{fmt(svc.base_price)}</span>
                </div>
                {(svc.selected_options as any[]).filter((o) => o.price_modifier !== 0).map((opt, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                    <span>{opt.item_label}</span>
                    <span>{opt.price_modifier > 0 ? `+${fmt(opt.price_modifier)}` : fmt(opt.price_modifier)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs text-foreground font-semibold border-t border-border/40 pt-1">
                  <span>Service subtotal</span>
                  <span>{fmt(total)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
              <span>Commitment deposit (25%)</span>
              <span>{fmt(depositAmt)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-foreground pt-0.5 border-t border-border/60">
              <span>Total charged</span>
              <span className="text-primary">{fmt(total)}</span>
            </div>
            {r.payment_status === "partially_refunded" && r.refund_amount != null && r.retained_amount != null && (
              <div className="pt-1 space-y-0.5">
                <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span>Retained by store</span>
                  <span>{fmt(r.retained_amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                  <span>Refunded to customer</span>
                  <span>{fmt(r.refund_amount)}</span>
                </div>
              </div>
            )}
            {r.payment_status === "refunded" && r.refund_amount != null && (
              <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 pt-1">
                <span>Full refund processed</span>
                <span>{fmt(r.refund_amount)}</span>
              </div>
            )}
          </div>

          <Divider />

          {/* Message Customer button — opens Messages tab */}
          <button
            data-testid={`button-message-customer-${r.id}`}
            onClick={() => {
              setPendingChat({ reservationId: r.id, customerName: displayName });
              setTab("messages");
            }}
            className="w-full h-9 rounded-xl border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-primary/5 active:scale-[0.97] mb-2"
          >
            <MessageSquare size={13} /> Message Customer
          </button>

          {/* ACTION BUTTONS ROW */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Back arrow — revert status */}
            <button
              data-testid={`button-revert-${r.id}`}
              onClick={() => canRevert && revertStatus(r.id, r.status)}
              disabled={!canRevert}
              title={canRevert ? `Revert to ${(cfg.prev ?? "").replace("_", " ")}` : "Already at first status"}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 border ${canRevert ? "border-border text-foreground hover:bg-secondary" : "border-border/30 text-muted-foreground/30 cursor-not-allowed"}`}
            >
              <ArrowLeft size={15} />
            </button>

            {/* Forward arrow — advance status */}
            {isArrived ? (
              <button
                data-testid={`button-enter-code-${r.id}`}
                onClick={() => { setCodeDialog(r.id); setCodeInput(""); setCodeError(""); }}
                className="flex-1 h-9 rounded-xl bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-purple-600 active:scale-[0.97]"
              >
                🔑 Enter Code
              </button>
            ) : (
              <button
                data-testid={`button-advance-${r.id}`}
                onClick={() => canAdvanceDirect && cycleStatus(r.id, r.status)}
                disabled={!canAdvanceDirect}
                title={canAdvanceDirect ? `Advance to ${(cfg.next ?? "").replace("_", " ")}` : isPast ? "Booking is closed" : "Already at final status"}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 border ${canAdvanceDirect ? "border-border text-foreground hover:bg-secondary" : "border-border/30 text-muted-foreground/30 cursor-not-allowed"}`}
              >
                <ArrowRight size={15} />
              </button>
            )}

            {/* Countdown until No Show is available */}
            {showNoShowCountdown && (
              <p className="flex-1 text-[11px] text-muted-foreground text-center py-1">
                ⏳ No Show in {minsUntilNoShow} min{minsUntilNoShow !== 1 ? "s" : ""}
              </p>
            )}

            {/* No Show — today, scheduled, ≥30 min past start */}
            {canNoShow && (
              <button
                data-testid={`button-no-show-${r.id}`}
                onClick={() => setNoShowDialog(r.id)}
                className="flex-1 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.97]"
              >
                <User size={12} /> No Show
              </button>
            )}

            {/* Receipt — completed or cancelled */}
            {isPast && (
              <button
                data-testid={`button-receipt-${r.id}`}
                onClick={() => setReceiptTarget(r)}
                className="flex-1 h-9 rounded-xl border border-border text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-secondary active:scale-[0.97]"
              >
                <Receipt size={13} /> Receipt
              </button>
            )}

            {/* Cancel for Customer — same-day, not yet past */}
            {canCancelForCustomer && (
              <button
                data-testid={`button-cancel-for-customer-${r.id}`}
                onClick={() => setCancelForCustomerDialog(r.id)}
                className="flex-1 h-9 rounded-xl border border-red-200 text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-red-50 active:scale-[0.97]"
              >
                ✕ Cancel
              </button>
            )}
          </div>
        </div>
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

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-6 flex flex-col">
      {/* ── Dark blue header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 px-5 py-4" style={{ background: "linear-gradient(135deg, hsl(220 85% 16%) 0%, hsl(213 82% 28%) 100%)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70 font-medium">Business Dashboard</p>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{store?.name || "My Store"}</h1>
              {store && (
                <button
                  onClick={() => setShowSubscription(true)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide active:scale-95 transition-all ${
                    store.subscription_tier === "premium"
                      ? "bg-amber-400 text-amber-900"
                      : store.subscription_tier === "pro"
                      ? "bg-blue-400 text-blue-900"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {store.subscription_tier === "premium" ? "👑 Premium" : store.subscription_tier === "pro" ? "⚡ Pro" : "Free"}
                </button>
              )}
            </div>
            <p className="text-xs text-white/60 mt-0.5">{format(new Date(), "EEEE, MMM d")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="button-toggle-theme-dashboard"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/15 text-white active:scale-95 transition-all"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              data-testid="button-open-menu"
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl bg-white/15 text-white active:scale-95 transition-all"
              aria-label="Open menu"
            >
              <MenuIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Announcement banner ──────────────────────────────────────────── */}
      {storeAnnouncement && (
        <div className="flex items-start gap-2 px-4 py-2.5 border-b border-blue-800/30" style={{ background: "linear-gradient(135deg, hsl(220 85% 20%) 0%, hsl(213 82% 32%) 100%)" }}>
          <Bell size={13} className="text-blue-200 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold leading-tight">{storeAnnouncement.title}</p>
            <p className="text-blue-100 text-[11px] leading-snug mt-0.5 line-clamp-2">{storeAnnouncement.message}</p>
          </div>
          <button
            onClick={() => {
              const dismissed: string[] = (() => { try { return JSON.parse(localStorage.getItem("booka_dismissed_ann") ?? "[]"); } catch { return []; } })();
              localStorage.setItem("booka_dismissed_ann", JSON.stringify([...dismissed, storeAnnouncement.id]));
              setStoreAnnouncement(null);
            }}
            className="w-5 h-5 flex items-center justify-center text-blue-200 hover:text-white active:scale-90 transition-all shrink-0 mt-0.5"
          >
            <XIcon size={13} />
          </button>
        </div>
      )}

      {/* ── Daily booking limit banners (free tier) ──────────────────────── */}
      {storeTier === "free" && (() => {
        const dailyLimit = DAILY_LIMITS[store?.category ?? ""] ?? 0;
        if (!dailyLimit) return null;
        const pct = dailyLimit > 0 ? todayBookingCount / dailyLimit : 0;
        if (pct >= 1) {
          return (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <AlertCircle size={13} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-800 dark:text-red-300 text-[11px] font-bold leading-tight">
                  Daily limit reached — {dailyLimit} bookings today
                </p>
                <p className="text-red-700 dark:text-red-400 text-[10px] mt-0.5">
                  All slots are now hidden from customers.{" "}
                  <button onClick={() => setShowSubscription(true)} className="underline font-semibold">Upgrade to Pro</button> for unlimited daily bookings.
                </p>
              </div>
            </div>
          );
        }
        if (pct >= 0.8) {
          return (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
              <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-amber-800 dark:text-amber-300 text-[11px] font-bold leading-tight">
                  You have used {todayBookingCount} of {dailyLimit} bookings today
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-[10px] mt-0.5">
                  <button onClick={() => setShowSubscription(true)} className="underline font-semibold">Upgrade to Pro</button> for unlimited daily bookings.
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

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

      {/* ── Onboarding Checklist ─────────────────────────────────────────── */}
      {tab === "reservations" && store && !store.onboarding_completed && (() => {
        const checks = [
          { label: "Upload a store photo", done: photos.length > 0, action: () => setTab("photos") },
          { label: "Add your first service", done: storeServices.length > 0, action: () => setTab("services") },
          { label: "Create booking slots", done: slots.length > 0, action: () => setTab("slots") },
          { label: "Write a store description", done: (store.description?.trim()?.length ?? 0) > 10, action: () => setTab("profile") },
          { label: "Set operating hours", done: storeServices.length > 0 && slots.length > 0, action: () => setTab("hours") },
        ];
        const doneCount = checks.filter(c => c.done).length;
        const allDone = doneCount === checks.length;
        if (allDone) {
          supabase.from("stores").update({ onboarding_completed: true } as any).eq("id", store.id).then(() => {
            setStore(prev => prev ? { ...prev, onboarding_completed: true } : prev);
          });
          return null;
        }
        return (
          <div className="mx-4 mt-3 mb-1 rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-blue-800 dark:text-blue-200">🚀 Getting Started</p>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">{doneCount}/{checks.length}</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 mb-3 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${(doneCount/checks.length)*100}%` }}/>
            </div>
            <div className="space-y-1.5">
              {checks.map((c, i) => (
                <button key={i} onClick={c.action} disabled={c.done}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all active:scale-[0.98] ${c.done ? "opacity-50 cursor-default" : "hover:bg-blue-100 dark:hover:bg-blue-800/40 active:bg-blue-200"}`}>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${c.done ? "border-blue-500 bg-blue-500" : "border-blue-300"}`}>
                    {c.done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`text-xs font-medium ${c.done ? "text-blue-500 line-through" : "text-blue-800 dark:text-blue-200"}`}>{c.label}</span>
                  {!c.done && <svg className="w-3 h-3 text-blue-400 ml-auto shrink-0" fill="none" viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

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
            <div className="flex items-center gap-1.5">
              <button
                data-testid="button-walk-in"
                onClick={() => {
                  setWalkInDate(TODAY);
                  setWalkInSlotId(null);
                  setWalkInName("");
                  setWalkInDialog(true);
                  fetchWalkInSlots(TODAY);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 active:scale-95 transition-all"
              >
                <UserPlus size={13} /> Walk In
              </button>
              <button
                onClick={() => { setRefreshing(true); fetchData(); }}
                className={`p-1.5 rounded-lg hover:bg-secondary ${refreshing ? "animate-spin" : ""}`}
              >
                <RefreshCw size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          <AnalyticsSection reservations={reservations} reviews={storeReviews} />

          {/* ── TODAY ─────────────────────────────────────────── */}
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Today</h2>
          {todayActive.length === 0 ? (
            <div className="p-4 rounded-2xl bg-secondary text-center mb-5">
              <p className="text-sm text-muted-foreground">No active bookings today</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {todayActive.map((r, i) => <ReservationCard key={r.id} r={r} i={i} />)}
            </div>
          )}

          {/* ── UPCOMING ──────────────────────────────────────── */}
          {upcomingReservations.length > 0 && (
            <>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Upcoming</h2>
              <div className="space-y-3 mb-6">
                {upcomingReservations.map((r, i) => <ReservationCard key={r.id} r={r} i={i} />)}
              </div>
            </>
          )}

          {/* ── PAST ──────────────────────────────────────────── */}
          {pastReservations.length > 0 && (
            <div className="mb-4">
              <button
                data-testid="button-toggle-past"
                onClick={() => setShowPast((p) => !p)}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-all active:scale-[0.98] mb-3"
              >
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Past Bookings ({pastReservations.length})
                </span>
                {showPast ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
              </button>
              {showPast && (
                <div className="space-y-3">
                  {pastReservations.map((r, i) => <ReservationCard key={r.id} r={r} i={i} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Slots tab ─────────────────────────────────────────────────────── */}
      {tab === "hours" && (
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 space-y-3">
          {hoursLoading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Business Hours</p>
                <Button size="sm" className="rounded-xl gap-1 text-xs h-8" onClick={saveAllHours} disabled={savingHours}>
                  {savingHours ? "Saving…" : "Save Hours"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground -mt-1 mb-2">Customers will only see booking slots during these hours.</p>

              {storeHours.map((hour, idx) => {
                const dayBreaks = storeBreaks.filter((b) => b.day_of_week === hour.day_of_week);
                return (
                  <div key={hour.day_of_week} className="p-4 rounded-2xl bg-card booka-shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-foreground w-8">{DAYS[hour.day_of_week]}</p>
                        <button
                          onClick={() => setStoreHours((prev) => prev.map((h, i) => i === idx ? { ...h, is_open: !h.is_open } : h))}
                          className={`relative w-11 h-6 rounded-full transition-all ${hour.is_open ? "bg-primary" : "bg-secondary"}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${hour.is_open ? "left-5" : "left-0.5"}`} />
                        </button>
                        <span className={`text-xs font-semibold ${hour.is_open ? "text-primary" : "text-muted-foreground"}`}>
                          {hour.is_open ? "Open" : "Closed"}
                        </span>
                      </div>
                    </div>

                    {hour.is_open && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input type="time" value={hour.open_time} onChange={(e) => setStoreHours((prev) => prev.map((h, i) => i === idx ? { ...h, open_time: e.target.value } : h))} className="rounded-xl text-sm h-9 flex-1" />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input type="time" value={hour.close_time} onChange={(e) => setStoreHours((prev) => prev.map((h, i) => i === idx ? { ...h, close_time: e.target.value } : h))} className="rounded-xl text-sm h-9 flex-1" />
                        </div>

                        {dayBreaks.length > 0 && (
                          <div className="space-y-1.5">
                            {dayBreaks.map((b) => (
                              <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary text-xs">
                                <span className="font-medium text-foreground flex-1">{b.label || "Break"}: {b.break_start.slice(0,5)} – {b.break_end.slice(0,5)}</span>
                                <button onClick={() => deleteBreak(b.id!)} className="text-destructive p-0.5 rounded active:scale-95">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => { setBreakDialog(hour.day_of_week); setNewBreakStart("12:00"); setNewBreakEnd("13:00"); setNewBreakLabel("Lunch"); }}
                          className="w-full text-xs font-semibold text-primary py-1.5 rounded-xl border border-dashed border-primary/40 hover:bg-primary/5 transition-all"
                        >
                          + Add Break
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              <Button className="w-full rounded-xl mt-2" onClick={saveAllHours} disabled={savingHours}>
                {savingHours ? "Saving…" : "Save All Hours"}
              </Button>
            </>
          )}

          {/* Add break dialog */}
          <Dialog open={breakDialog !== null} onOpenChange={(o) => { if (!o) setBreakDialog(null); }}>
            <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
              <DialogHeader><DialogTitle>Add Break — {breakDialog !== null ? DAYS[breakDialog] : ""}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Break Label (optional)</p>
                  <Input placeholder="e.g. Lunch, Prayer Time" value={newBreakLabel} onChange={(e) => setNewBreakLabel(e.target.value)} className="rounded-xl" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Break Time</p>
                  <div className="flex gap-2">
                    <Input type="time" value={newBreakStart} onChange={(e) => setNewBreakStart(e.target.value)} className="rounded-xl" />
                    <Input type="time" value={newBreakEnd} onChange={(e) => setNewBreakEnd(e.target.value)} className="rounded-xl" />
                  </div>
                </div>
                <Button className="w-full rounded-xl" onClick={() => breakDialog !== null && addBreak(breakDialog)}>
                  Add Break
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── Calendar tab ──────────────────────────────────────────────────── */}
      {tab === "calendar" && store && (
        <div className="flex-1 overflow-y-auto">
          <StoreCalendar storeId={store.id} />
        </div>
      )}

      {/* ── Services (Menu) tab ───────────────────────────────────────────── */}
      {tab === "services" && (
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Service Menu</h2>
            <Button data-testid="button-add-service" size="sm" className="rounded-xl gap-1 text-xs h-8"
              onClick={() => {
                if (storeServices.filter(s => s.is_active).length >= tierSvcLimit) {
                  toast.error("Free plan is limited to 3 services. Upgrade to Pro for unlimited.");
                  setShowSubscription(true);
                  return;
                }
                setNewSvcName(""); setNewSvcDesc(""); setNewSvcPrice("0"); setServiceDialog(true);
              }}>
              <Plus size={13} /> Add Service
            </Button>
          </div>

          {loadingServices ? (
            <div className="space-y-3">
              {[1,2].map((i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}
            </div>
          ) : storeServices.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-secondary">
              <Package size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm font-semibold text-foreground">No services yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first service to let customers customise their booking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {storeServices.map((svc) => {
                const isExpanded = expandedService === svc.id;
                return (
                  <div key={svc.id} className="rounded-2xl bg-card booka-shadow overflow-hidden">
                    {/* Service header */}
                    <div className="p-4 flex items-center gap-3">
                      <button
                        onClick={() => setExpandedService(isExpanded ? null : svc.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={16} className="text-primary shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
                          <div>
                            <p className="text-sm font-semibold text-foreground">{svc.name}</p>
                            {svc.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{svc.description}</p>}
                            <p className="text-xs text-primary font-semibold mt-0.5">
                              Base: J${svc.base_price.toFixed(0)} · {svc.service_option_groups.length} option group{svc.service_option_groups.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      </button>
                      {/* Active toggle */}
                      <button
                        onClick={() => toggleServiceActive(svc)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${svc.is_active ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground"}`}
                      >
                        {svc.is_active ? "Active" : "Off"}
                      </button>
                      <button onClick={() => openEditSvc(svc)} className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground transition-all">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteService(svc.id)} className="p-1.5 rounded-xl hover:bg-red-50 text-red-400 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Expanded: option groups */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                        {svc.service_option_groups.length === 0 && (
                          <p className="text-xs text-muted-foreground">No option groups yet. Add one below.</p>
                        )}
                        {[...svc.service_option_groups].sort((a, b) => a.sort_order - b.sort_order).map((grp) => (
                          <div key={grp.id} className="rounded-xl bg-secondary/60 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground">{grp.label}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {grp.selection_type === "single" ? "Pick one" : "Pick many"}
                                  </span>
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${grp.required ? "bg-orange-100 text-orange-600" : "bg-secondary text-muted-foreground"}`}>
                                    {grp.required ? "Required" : "Optional"}
                                  </span>
                                </div>
                              </div>
                              <button onClick={() => deleteGroup(svc.id, grp.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400 transition-all">
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {/* Items */}
                            <div className="flex flex-wrap gap-1.5">
                              {[...grp.service_option_items].sort((a, b) => a.sort_order - b.sort_order).map((item) => (
                                <div key={item.id} className="flex items-center gap-1 bg-card rounded-lg px-2 py-1 border border-border">
                                  <span className="text-xs text-foreground">{item.label}</span>
                                  {item.price_modifier !== 0 && (
                                    <span className="text-[10px] font-bold text-primary">
                                      {item.price_modifier > 0 ? `+J$${item.price_modifier.toFixed(0)}` : `J$${item.price_modifier.toFixed(0)}`}
                                    </span>
                                  )}
                                  <button onClick={() => deleteItem(svc.id, grp.id, item.id)} className="text-red-400 hover:text-red-600 ml-0.5">
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => { setNewItemLabel(""); setNewItemPrice("0"); setItemDialog(grp.id + "|" + svc.id); }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/5 transition-all"
                              >
                                <Plus size={11} /> Add option
                              </button>
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full rounded-xl gap-1 text-xs h-8"
                          onClick={() => { setNewGrpLabel(""); setNewGrpType("single"); setNewGrpRequired(true); setGroupDialog(svc.id); }}
                        >
                          <Plus size={13} /> Add Option Group
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground">Categories</p>
              <button
                type="button"
                onClick={() => setShowSubscription(true)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  storeTier === "free" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-secondary text-muted-foreground"
                }`}
              >
                {storeTier === "free" ? "1 category on Free" : storeTier === "pro" ? "Up to 3 on Pro" : "Unlimited"}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = editCategories.includes(cat.label);
                const isPrimary = isSelected && cat.label === (store?.category ?? "") && !!store?.category;
                const wouldExceed = !isSelected && editCategories.length >= tierCatLimit;
                return (
                  <button key={cat.label} type="button"
                    onClick={() => {
                      if (isSelected) {
                        // Block deselection of the locked primary category
                        if (isPrimary && isCategoryLocked) {
                          toast.error(`Primary category locked until ${lockDateStr}. Unlocks in ${daysUntilUnlock} day${daysUntilUnlock !== 1 ? "s" : ""}.`);
                          return;
                        }
                        setEditCategories((prev) => prev.filter((c) => c !== cat.label));
                        return;
                      }
                      // Re-read current editCategories length from latest state
                      setEditCategories((prev) => {
                        if (prev.length >= tierCatLimit) {
                          toast.error(
                            storeTier === "free"
                              ? "Free plan allows 1 category. Upgrade to Pro for up to 3."
                              : "Pro plan allows 3 categories. Upgrade to Premium for unlimited."
                          );
                          setTimeout(() => setShowSubscription(true), 50);
                          return prev; // no change
                        }
                        return [...prev, cat.label];
                      });
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 relative ${
                      isSelected
                        ? "bg-primary text-primary-foreground booka-shadow"
                        : wouldExceed
                        ? "bg-secondary opacity-35 cursor-not-allowed"
                        : "bg-secondary"
                    }`}>
                    {isPrimary && isCategoryLocked && (
                      <span className="absolute top-1 right-1"><Lock size={8} className="text-amber-300" /></span>
                    )}
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="text-[8px] font-bold text-center leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Lock status / first-save note */}
            {isCategoryLocked && (
              <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <Lock size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    Primary category locked until {lockDateStr}
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Unlocks in {daysUntilUnlock} day{daysUntilUnlock !== 1 ? "s" : ""}. Secondary categories can still be changed.
                  </p>
                </div>
              </div>
            )}
            {!isCategoryLocked && !store?.category?.trim() && editCategories.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Lock size={10} className="shrink-0" />
                Your primary category will be locked for 7 days after saving.
              </p>
            )}
            {editCategories.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Primary: <strong>{editCategories[0]}</strong>
                {editCategories.length > 1 && ` · +${editCategories.length - 1} more`}
              </p>
            )}
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
                <SelectItem value="15">15 minutes — default</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Late-night surcharge (Pro/Premium only) */}
          {(storeTier === "pro" || storeTier === "premium") && (
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Late-Night Surcharge</p>
              <p className="text-xs text-muted-foreground">Automatically add a surcharge for bookings after a certain time.</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">From Time</p>
                  <Input type="time" value={lateNightStart} onChange={(e) => setLateNightStart(e.target.value)} className="rounded-xl h-9" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Surcharge (J$)</p>
                  <Input type="number" min="0" placeholder="0" value={lateNightSurcharge} onChange={(e) => setLateNightSurcharge(e.target.value)} className="rounded-xl h-9" />
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={saveLateNight}>
                Save Surcharge
              </Button>
            </div>
          )}

          <Button data-testid="button-save-profile" className="w-full rounded-xl" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>

          <Button data-testid="button-sign-out" variant="outline"
            className="w-full rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={signOut}>
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      )}

      {/* ── Reviews tab ───────────────────────────────────────────────────── */}
      {tab === "reviews" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Summary card */}
          {storeReviews.length > 0 && (() => {
            const avg = (storeReviews.reduce((s, r) => s + r.rating, 0) / storeReviews.length);
            const avgStr = avg.toFixed(1);
            return (
              <div className="p-5 rounded-2xl booka-gradient text-white booka-shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold leading-none">{avgStr}</p>
                    <div className="flex items-center gap-0.5 mt-1.5 justify-center">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} size={14} className={n <= Math.round(avg) ? "fill-white text-white" : "text-white/40"} />
                      ))}
                    </div>
                  </div>
                  <div className="w-px h-12 bg-white/30" />
                  <div>
                    <p className="text-2xl font-bold">{storeReviews.length}</p>
                    <p className="text-xs text-white/75 mt-0.5">{storeReviews.length === 1 ? "review" : "total reviews"}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {storeReviews.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No reviews yet</p>
              <p className="text-xs mt-1">Reviews from customers will appear here</p>
            </div>
          )}

          {/* Review cards */}
          {storeReviews.map((review) => {
            const name = review.reviewer_name || "Customer";
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <div key={review.id} className="p-4 rounded-2xl bg-card booka-shadow-sm border border-border/50 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full booka-gradient flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{name}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{timeAgo(review.created_at)}</span>
                    </div>
                    <Stars rating={review.rating} />
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed pl-12">{review.comment}</p>
                )}
                {review.store_reply ? (
                  <div className="ml-12 pl-3 border-l-2 border-primary/30 bg-primary/[0.03] rounded-r-lg py-2 pr-2">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Your Reply</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{review.store_reply}</p>
                    <button
                      data-testid={`button-edit-reply-${review.id}`}
                      onClick={() => { setReplyTarget(review.id); setReplyText(review.store_reply || ""); }}
                      className="mt-1.5 flex items-center gap-1 text-xs text-primary font-semibold"
                    >
                      <Pencil size={11} /> Edit Reply
                    </button>
                  </div>
                ) : (
                  <button
                    data-testid={`button-reply-${review.id}`}
                    onClick={() => { setReplyTarget(review.id); setReplyText(""); }}
                    className="ml-12 flex items-center gap-1.5 text-xs text-primary font-semibold"
                  >
                    <Reply size={12} /> Reply
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Photos tab ────────────────────────────────────────────────────── */}
      {tab === "photos" && store && (
        <div className="flex-1 px-5 pt-4 pb-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-foreground text-base">Store Photos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {photos.length} / {storeTier === "premium" ? "∞" : tierPhotoLimit} photos
                {storeTier === "free" && " · Upgrade for more"}
              </p>
            </div>
            <button
              data-testid="button-add-photo"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-all"
            >
              <ImagePlus size={14} /> Add Photo
            </button>
          </div>

          {/* Hidden file input */}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={selectPhotoFile} />

          {photosLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0,1,2,3].map((i) => <div key={i} className="aspect-square rounded-2xl booka-shimmer" />)}
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                <Image size={28} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground text-sm">No photos yet</p>
              <p className="text-xs text-muted-foreground text-center">Add photos to showcase your work and attract more customers</p>
              <button onClick={() => photoInputRef.current?.click()} className="mt-2 px-4 py-2 rounded-xl border border-dashed border-primary text-primary text-xs font-semibold active:scale-95 transition-all">
                Upload your first photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo, idx) => (
                <div key={photo.id} data-testid={`photo-card-${photo.id}`} className="relative rounded-2xl overflow-hidden border border-border bg-card">
                  <button onClick={() => setPhotoFullscreen(photo.image_url)} className="block w-full">
                    <img src={photo.image_url} alt={photo.caption ?? "Store photo"} className="w-full aspect-square object-cover" />
                  </button>
                  {photo.is_cover && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      <CheckCircle2 size={10} /> Cover
                    </div>
                  )}
                  {photo.caption && (
                    <p className="px-2 py-1.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">{photo.caption}</p>
                  )}
                  <div className="flex items-center gap-1 px-2 pb-2">
                    {!photo.is_cover && (
                      <button onClick={() => setCoverPhoto(photo)} className="flex-1 h-7 rounded-lg text-[10px] font-semibold border border-primary/40 text-primary active:scale-95 transition-all">
                        Set Cover
                      </button>
                    )}
                    {idx > 0 && (
                      <button onClick={() => movePhoto(photo, "up")} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center active:scale-95 transition-all">
                        <ChevronUp size={12} />
                      </button>
                    )}
                    {idx < photos.length - 1 && (
                      <button onClick={() => movePhoto(photo, "down")} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center active:scale-95 transition-all">
                        <ChevronDown size={12} />
                      </button>
                    )}
                    <button onClick={() => { if (confirm("Delete this photo?")) deletePhoto(photo); }} className="w-7 h-7 rounded-lg border border-red-200 text-red-500 flex items-center justify-center active:scale-95 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Photo upload dialog ──────────────────────────────────────────── */}
      {photoUploadDialog && pendingPhotoPreview && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center" onClick={() => { if (!uploadingPhoto) { setPhotoUploadDialog(false); setPendingPhotoFile(null); setPendingPhotoPreview(null); setPhotoCaption(""); } }}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-card rounded-t-3xl p-5 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-foreground text-base">Add Photo</p>
            <img src={pendingPhotoPreview} alt="Preview" className="w-full aspect-video object-cover rounded-2xl" />
            <input
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPhotoUploadDialog(false); setPendingPhotoFile(null); setPendingPhotoPreview(null); setPhotoCaption(""); }} className="flex-1 rounded-xl" disabled={uploadingPhoto}>
                Cancel
              </Button>
              <Button onClick={uploadPhoto} disabled={uploadingPhoto} className="flex-1 rounded-xl">
                {uploadingPhoto ? <><RefreshCw size={14} className="animate-spin mr-1.5" /> Uploading…</> : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo fullscreen view ────────────────────────────────────────── */}
      {photoFullscreen && (
        <div className="fixed inset-0 z-[400] bg-black flex items-center justify-center" onClick={() => setPhotoFullscreen(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:scale-90 transition-all z-10">
            <XIcon size={20} />
          </button>
          <img src={photoFullscreen} alt="Full view" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {tab === "messages" && store && (
        <StoreMessagesTab
          storeId={store.id}
          onUnreadChange={setStoreUnreadMsgCount}
          autoOpen={pendingChat}
          onAutoOpenHandled={() => setPendingChat(null)}
          onOpenChat={(target) => {
            setStoreChatTarget(target);
            setTab("messages");
          }}
          refreshTrigger={storeMessagesRefreshTrigger}
        />
      )}

      {/* ── Hamburger Drawer ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[350]" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}
      <div
        className={`fixed top-0 right-0 h-full z-[360] w-72 bg-card shadow-2xl flex flex-col transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="px-5 pt-12 pb-4 border-b border-border" style={{ background: "linear-gradient(135deg, hsl(220 85% 16%) 0%, hsl(213 82% 28%) 100%)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {store?.name?.slice(0, 1).toUpperCase() ?? "S"}
            </div>
            <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-xl bg-white/15 text-white active:scale-95">
              <XIcon size={16} />
            </button>
          </div>
          <p className="text-white font-bold text-base leading-tight">{store?.name ?? "My Store"}</p>
          <button onClick={() => { setShowSubscription(true); setDrawerOpen(false); }}
            className={`mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${store?.subscription_tier === "premium" ? "bg-amber-400 text-amber-900" : store?.subscription_tier === "pro" ? "bg-blue-400 text-blue-900" : "bg-white/20 text-white"}`}>
            {store?.subscription_tier === "premium" ? "👑 Premium" : store?.subscription_tier === "pro" ? "⚡ Pro" : "Free"}
          </button>
        </div>

        {/* Drawer nav items */}
        <div className="flex-1 overflow-y-auto py-2">
          {[
            { id: "reservations" as const, label: "Bookings", icon: Calendar },
            { id: "hours" as const, label: "Hours", icon: Clock },
            { id: "services" as const, label: "Menu", icon: Package },
            { id: "photos" as const, label: "Photos", icon: Image },
            { id: "messages" as const, label: "Messages", icon: MessageSquare, badge: storeUnreadMsgCount },
            { id: "reviews" as const, label: "Reviews", icon: Star },
            { id: "profile" as const, label: "Profile", icon: Settings },
            { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
          ].map((item) => {
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                data-testid={`tab-${item.id}`}
                onClick={() => { setTab(item.id); setDrawerOpen(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all active:scale-[0.98] ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"}`}
              >
                <div className="relative">
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  {(item as any).badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {(item as any).badge > 9 ? "9+" : (item as any).badge}
                    </span>
                  )}
                </div>
                <span className={`text-sm font-medium ${isActive ? "font-semibold" : ""}`}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer footer */}
        <div className="border-t border-border py-2">
          <button
            onClick={() => { setDrawerOpen(false); onBack(); }}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-foreground hover:bg-secondary transition-all"
          >
            <ArrowLeft size={20} strokeWidth={1.8} />
            <span className="text-sm font-medium">Back to App</span>
          </button>
          <button
            onClick={() => { setDrawerOpen(false); signOut(); }}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <LogOut size={20} strokeWidth={1.8} />
            <span className="text-sm font-semibold">Sign Out</span>
          </button>
        </div>
      </div>

      {/* ── Subscription / Plans page ─────────────────────────────────────── */}
      {showSubscription && (
        <div className="fixed inset-0 z-[350] flex flex-col bg-background overflow-y-auto">
          {/* Header */}
          <div className="shrink-0 sticky top-0 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-2 z-10">
            <button onClick={() => setShowSubscription(false)} className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-foreground">My Plan</h1>
              <p className="text-xs text-muted-foreground">
                Current plan: <span className="font-semibold capitalize">{store?.subscription_tier ?? "free"}</span>
              </p>
            </div>
          </div>

          <div className="px-4 py-5 space-y-4">

            {/* Current plan banner */}
            <div className={`rounded-2xl p-4 ${
              store?.subscription_tier === "premium"
                ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-300"
                : store?.subscription_tier === "pro"
                ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-300"
                : "bg-secondary border border-border"
            }`}>
              <div className="flex items-center gap-3">
                {store?.subscription_tier === "premium" ? (
                  <Crown size={28} className="text-amber-500 shrink-0" />
                ) : store?.subscription_tier === "pro" ? (
                  <Zap size={28} className="text-blue-500 shrink-0" />
                ) : (
                  <Store size={28} className="text-muted-foreground shrink-0" />
                )}
                <div>
                  <p className="font-bold text-foreground text-base capitalize">{store?.subscription_tier ?? "free"} Plan</p>
                  <p className="text-xs text-muted-foreground">
                    {store?.subscription_tier === "premium"
                      ? "J$5,000/month · All features unlocked"
                      : store?.subscription_tier === "pro"
                      ? "J$2,500/month · Most features unlocked"
                      : "J$0/month · Limited features"}
                  </p>
                </div>
              </div>
            </div>

            {/* Plan cards */}
            {[
              {
                tier: "free" as const,
                name: "Free",
                price: "J$0",
                icon: Store,
                iconColor: "text-slate-500",
                bg: "bg-secondary",
                border: "border-border",
                features: [
                  "1 category",
                  "3 services (flat pricing only)",
                  "5 store photos",
                  "Daily booking limits enforced",
                  "1 employee account",
                  "Initials avatar (no logo)",
                  "Standard search ranking",
                  "No messaging, no analytics",
                  "24-hour cancellation policy only",
                ],
                limits: true,
              },
              {
                tier: "pro" as const,
                name: "Pro",
                price: "J$2,500/mo",
                icon: Zap,
                iconColor: "text-blue-500",
                bg: "bg-blue-50 dark:bg-blue-900/20",
                border: "border-blue-300 dark:border-blue-700",
                features: [
                  "1 primary + 2 secondary categories",
                  "Unlimited services with option groups",
                  "20 store photos",
                  "Up to 3 employee accounts",
                  "Store photo / logo upload",
                  "Category emoji on map pin",
                  "Priority search ranking",
                  "Blue verified badge",
                  "Customer messaging enabled",
                  "Basic analytics",
                  "Review replies",
                  "Custom time slots & cancellation policy",
                  "1 free reschedule per customer/month",
                  "Announcement banner",
                ],
                limits: false,
              },
              {
                tier: "premium" as const,
                name: "Premium",
                price: "J$5,000/mo",
                icon: Crown,
                iconColor: "text-amber-500",
                bg: "bg-amber-50 dark:bg-amber-900/20",
                border: "border-amber-300 dark:border-amber-700",
                features: [
                  "Unlimited secondary categories",
                  "Unlimited services & customization",
                  "Unlimited photos",
                  "Unlimited employee accounts",
                  "Package deals & bundles",
                  "Gift cards & memberships",
                  "Unlimited posts (never expire)",
                  "Sponsored map pin placement",
                  "Gold crown verified badge",
                  "Full advanced analytics",
                  "Priority messaging with read receipts",
                  "Up to 3 locations",
                  "Unlimited reschedules",
                  "Custom branded receipts",
                  "Export all data as CSV",
                  "Priority support",
                ],
                limits: false,
              },
            ].map((plan) => {
              const isCurrent = (store?.subscription_tier ?? "free") === plan.tier;
              const PlanIcon = plan.icon;
              return (
                <div key={plan.tier} className={`rounded-2xl border p-4 ${plan.bg} ${plan.border} ${isCurrent ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PlanIcon size={20} className={plan.iconColor} />
                      <span className="font-bold text-foreground">{plan.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">CURRENT</span>
                      )}
                    </div>
                    <span className="font-bold text-foreground text-sm">{plan.price}</span>
                  </div>
                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                        <CheckCircle2 size={12} className={`${plan.iconColor} mt-0.5 shrink-0`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <button
                      onClick={() => {
                        const msg = encodeURIComponent(
                          `Hi! I'd like to upgrade my Booka store "${store?.name}" to the ${plan.name} plan (${plan.price}). My store ID is ${store?.id}.`
                        );
                        window.open(`https://wa.me/18761234567?text=${msg}`, "_blank");
                      }}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm text-white active:scale-[0.98] transition-all ${
                        plan.tier === "premium"
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "bg-blue-500 hover:bg-blue-600"
                      }`}
                    >
                      Upgrade to {plan.name}
                    </button>
                  )}
                  {isCurrent && plan.tier === "free" && (
                    <p className="text-center text-xs text-muted-foreground pt-1">Tap a plan above to upgrade via WhatsApp</p>
                  )}
                </div>
              );
            })}

            <p className="text-center text-xs text-muted-foreground pb-4">
              To upgrade, tap the plan and we'll connect you via WhatsApp. Payment processing coming soon.
            </p>
          </div>
        </div>
      )}

      {/* ── Edit Service dialog ───────────────────────────────────────────── */}
      <Dialog open={editSvcDialog} onOpenChange={(o) => { if (!o) { setEditSvcDialog(false); setEditSvcTarget(null); } }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <Input placeholder="Service name" value={editSvcName} onChange={(e) => setEditSvcName(e.target.value)} className="rounded-xl" autoFocus />
            <Textarea placeholder="Description (optional)" value={editSvcDesc} onChange={(e) => setEditSvcDesc(e.target.value)} className="rounded-xl resize-none" rows={2} />
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Base Price (J$)</label>
              <Input type="number" min="0" value={editSvcPrice} onChange={(e) => setEditSvcPrice(e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div>
              {(() => {
                const catDur = CATEGORY_DURATIONS[store?.category ?? ""];
                return (
                  <>
                    <label className="text-xs font-semibold text-muted-foreground">Duration (minutes)</label>
                    <Input
                      type="number"
                      min={catDur && storeTier === "free" ? catDur.min : "5"}
                      max={catDur && storeTier === "free" ? catDur.max : undefined}
                      step="5"
                      placeholder={catDur ? `e.g. ${catDur.default}` : "e.g. 30"}
                      value={editSvcDuration}
                      onChange={(e) => setEditSvcDuration(e.target.value)}
                      className="rounded-xl mt-1"
                    />
                    {catDur && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {storeTier === "free"
                          ? `Free plan: ${catDur.min}–${catDur.max} mins for ${store?.category}`
                          : `Typical: ${catDur.min}–${catDur.max} mins for ${store?.category}`}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm font-medium">Active</span>
              <button
                onClick={() => setEditSvcActive(!editSvcActive)}
                className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${editSvcActive ? "bg-green-500" : "bg-secondary border border-border"}`}
                style={{ width: 42, height: 24 }}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${editSvcActive ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            <Button className="w-full rounded-xl" onClick={saveEditService} disabled={savingEditSvc || !editSvcName.trim()}>
              {savingEditSvc ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Category change confirmation dialog ───────────────────────────── */}
      {pendingCategoryChange && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPendingCategoryChange(false)} />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <p className="font-bold text-foreground text-base">Change Primary Category?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Changing your category to <span className="font-semibold text-foreground">{editCategories[0]}</span> will update your default services to match. Your custom services will be kept.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setPendingCategoryChange(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={() => { setPendingCategoryChange(false); saveProfile(true); }}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Service dialog ────────────────────────────────────────────── */}
      <Dialog open={serviceDialog} onOpenChange={(o) => { if (!o) setServiceDialog(false); }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New Service</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <Input placeholder="Service name (e.g. Full Groom, Braids)" value={newSvcName} onChange={(e) => setNewSvcName(e.target.value)} className="rounded-xl" autoFocus />
            <Textarea placeholder="Description (optional)" value={newSvcDesc} onChange={(e) => setNewSvcDesc(e.target.value)} className="rounded-xl resize-none" rows={2} />
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Base Price (J$)</label>
              <Input type="number" min="0" placeholder="0" value={newSvcPrice} onChange={(e) => setNewSvcPrice(e.target.value)} className="rounded-xl mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Set to 0 if the price is fully determined by option selections.</p>
            </div>
            <div>
              {(() => {
                const catDur = CATEGORY_DURATIONS[store?.category ?? ""];
                return (
                  <>
                    <label className="text-xs font-semibold text-muted-foreground">Duration (minutes)</label>
                    <Input
                      type="number"
                      min={catDur && storeTier === "free" ? catDur.min : "5"}
                      max={catDur && storeTier === "free" ? catDur.max : undefined}
                      step="5"
                      placeholder={catDur ? `e.g. ${catDur.default}` : "e.g. 60"}
                      value={newSvcDuration}
                      onChange={(e) => setNewSvcDuration(e.target.value)}
                      className="rounded-xl mt-1"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {catDur
                        ? storeTier === "free"
                          ? `Free plan: ${catDur.min}–${catDur.max} mins for ${store?.category}`
                          : `Typical: ${catDur.min}–${catDur.max} mins for ${store?.category}. Leave blank to skip.`
                        : "Helps customers know how long to expect."}
                    </p>
                  </>
                );
              })()}
            </div>
            <Button className="w-full rounded-xl" onClick={addService} disabled={savingService || !newSvcName.trim()}>
              {savingService ? "Adding…" : "Add Service"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Option Group dialog ───────────────────────────────────────── */}
      <Dialog open={!!groupDialog} onOpenChange={(o) => { if (!o) setGroupDialog(null); }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New Option Group</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <Input placeholder="Group label (e.g. Dog Size, Cut Style)" value={newGrpLabel} onChange={(e) => setNewGrpLabel(e.target.value)} className="rounded-xl" autoFocus />
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Selection Type</label>
              <div className="flex gap-2">
                {(["single", "multi"] as const).map((t) => (
                  <button key={t} onClick={() => setNewGrpType(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${newGrpType === t ? "bg-primary text-white border-primary" : "bg-secondary border-border text-foreground"}`}>
                    {t === "single" ? "Pick one" : "Pick many"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Required?</label>
              <div className="flex gap-2">
                {([true, false] as const).map((v) => (
                  <button key={String(v)} onClick={() => setNewGrpRequired(v)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${newGrpRequired === v ? "bg-primary text-white border-primary" : "bg-secondary border-border text-foreground"}`}>
                    {v ? "Required" : "Optional"}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full rounded-xl" onClick={() => groupDialog && addGroup(groupDialog)} disabled={savingGroup || !newGrpLabel.trim()}>
              {savingGroup ? "Adding…" : "Add Group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Option Item dialog ────────────────────────────────────────── */}
      <Dialog open={!!itemDialog} onOpenChange={(o) => { if (!o) setItemDialog(null); }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>New Option</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <Input placeholder="Option label (e.g. Small · 0–10 lbs, Teddy Bear Cut)" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} className="rounded-xl" autoFocus />
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Price Modifier (J$)</label>
              <Input type="number" placeholder="0" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="rounded-xl mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Use a positive number to add cost, 0 if included in the base price.</p>
            </div>
            <Button className="w-full rounded-xl" onClick={() => {
              if (!itemDialog) return;
              const [groupId, serviceId] = itemDialog.split("|");
              addItem(groupId, serviceId);
            }} disabled={savingItem || !newItemLabel.trim()}>
              {savingItem ? "Adding…" : "Add Option"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Walk-in dialog ────────────────────────────────────────────────── */}
      <Dialog open={walkInDialog} onOpenChange={(o) => { if (!o) { setWalkInDialog(false); setWalkInName(""); setWalkInSlotId(null); } }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Add Walk-in Booking</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Date</label>
              <Input
                type="date"
                value={walkInDate}
                min={TODAY}
                onChange={(e) => { setWalkInDate(e.target.value); fetchWalkInSlots(e.target.value); }}
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Time Slot</label>
              {walkInLoading ? (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded-xl booka-shimmer" />)}
                </div>
              ) : walkInSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2 py-3 text-center bg-secondary rounded-xl">No slots available for this day</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {walkInSlots.map((slot) => {
                    const isTaken = walkInTakenIds.has(slot.id);
                    const isSelected = walkInSlotId === slot.id;
                    const fmt12wi = (t: string) => { const [h, m] = t.slice(0, 5).split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ap}`; };
                    return (
                      <button
                        key={slot.id}
                        onClick={() => !isTaken && setWalkInSlotId(slot.id)}
                        disabled={isTaken}
                        className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                          isTaken
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
                            : isSelected
                            ? "booka-gradient text-white booka-shadow-blue"
                            : "bg-card border border-border hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        {fmt12wi(slot.start_time)} – {fmt12wi(slot.end_time)}
                        {isTaken && <span className="block text-[10px]">Full</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Customer Name (optional)</label>
              <Input
                placeholder="e.g. John Smith"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="rounded-xl mt-1"
                data-testid="input-walkin-name"
              />
            </div>
            <Button
              className="w-full rounded-xl"
              onClick={createWalkIn}
              disabled={savingWalkIn || !walkInSlotId}
              data-testid="button-confirm-walkin"
            >
              {savingWalkIn ? "Adding…" : "Add Walk-in Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* ── Receipt dialog ────────────────────────────────────────────────── */}
      {receiptTarget && (
        <ReceiptDialog
          open={!!receiptTarget}
          reservation={{
            ...receiptTarget,
            stores: store ? {
              name: store.name,
              category: store.category,
              address: store.address,
            } : null,
          }}
          customerName={receiptTarget.customer_name || receiptTarget.customer_label}
          service={receiptTarget.reservation_services?.[0] ?? null}
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {/* ── Code entry dialog (arrived → in_progress) ─────────────────────── */}
      <Dialog open={!!codeDialog} onOpenChange={(o) => { if (!o) { setCodeDialog(null); setCodeInput(""); setCodeError(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Enter Customer Check-In Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask the customer for their 4-digit check-in code to mark this appointment as In Progress.
            </p>
            <input
              data-testid="input-checkin-code"
              type="number"
              inputMode="numeric"
              maxLength={4}
              placeholder="_ _ _ _"
              value={codeInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setCodeInput(val);
                setCodeError("");
              }}
              className="w-full text-center text-3xl font-extrabold tracking-[0.5em] font-mono border-2 border-border rounded-2xl py-4 bg-background outline-none focus:border-purple-400 transition-colors"
              autoFocus
            />
            {codeError && (
              <p className="text-xs text-red-500 text-center font-medium">{codeError}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setCodeDialog(null); setCodeInput(""); setCodeError(""); }}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
                onClick={handleCodeSubmit}
                disabled={codeInput.length !== 4 || codeSubmitting}
              >
                {codeSubmitting ? "Verifying…" : "Confirm Code"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel for Customer dialog ─────────────────────────────────────── */}
      <Dialog open={!!cancelForCustomerDialog} onOpenChange={(o) => { if (!o) setCancelForCustomerDialog(null); }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Cancel on Behalf of Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                Are you sure you want to cancel this appointment on behalf of the customer? The customer will be notified that the store cancelled.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCancelForCustomerDialog(null)}>
                Go Back
              </Button>
              <Button
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                onClick={handleCancelForCustomer}
                disabled={cancellingForCustomer}
              >
                {cancellingForCustomer ? "Cancelling…" : "Yes, Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── No Show confirmation dialog ─────────────────────────────────────── */}
      <Dialog open={!!noShowDialog} onOpenChange={(o) => { if (!o) setNoShowDialog(null); }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Mark as No Show?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200">
              <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                This customer has not checked in 30 minutes after their appointment time. Marking as No Show will retain the commitment fee.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setNoShowDialog(null)}>
                Go Back
              </Button>
              <Button
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                onClick={() => noShowDialog && markNoShow(noShowDialog)}
                disabled={confirmingNoShow}
              >
                {confirmingNoShow ? "Marking…" : "Mark No Show"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Store chat screen — rendered at top level to avoid z-index issues ── */}
      {storeChatTarget && store && (
        <div className="fixed inset-0 z-[100]">
          <ChatScreen
            reservationId={storeChatTarget.reservationId}
            storeName={store.name}
            customerName={storeChatTarget.customerName}
            currentRole="store"
            onBack={() => {
              setStoreChatTarget(null);
              setStoreMessagesRefreshTrigger((n) => n + 1);
            }}
          />
        </div>
      )}

    </div>
  );
};

export default StoreDashboard;
