import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar, Clock, MapPin, Star, RefreshCw, XCircle, LogIn, Receipt, Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import ReviewDialog from "@/components/ReviewDialog";
import ReceiptDialog, { type ReservationServiceData } from "@/components/ReceiptDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getCategoryEmoji } from "@/lib/categories";

interface Reservation {
  id: string;
  store_id: string;
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
  checkin_code?: string;
  cancelled_by?: string;
  stores: {
    name: string;
    category?: string;
    address: string;
    cancellation_hours?: number;
  } | null;
  reservation_services?: ReservationServiceData[];
}

type BookingsTab = "upcoming" | "history" | "cancelled";

const TODAY = format(new Date(), "yyyy-MM-dd");

const statusColors: Record<string, string> = {
  scheduled:   "bg-blue-500 text-white",
  arrived:     "bg-purple-500 text-white",
  in_progress: "bg-orange-500 text-white",
  completed:   "bg-green-500 text-white",
  cancelled:   "bg-red-400 text-white",
  no_show:     "bg-slate-500 text-white",
};

const statusLabels: Record<string, string> = {
  scheduled:   "Scheduled",
  arrived:     "Arrived",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
  no_show:     "No Show",
};

const fmt = (p: number) => `J$${Number(p).toFixed(0)}`;

function checkCancellation(r: Reservation): {
  allowed: boolean; tooLate: boolean; feeForfeited: boolean; message: string;
} {
  const now = new Date();
  const apptDateTime = new Date(`${r.reservation_date}T${r.start_time}`);
  const hoursUntil = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 1) {
    return { allowed: false, tooLate: true, feeForfeited: false, message: "It is too late to cancel this appointment. Please contact the store directly." };
  }
  const cancHours = r.stores?.cancellation_hours ?? 24;
  const feeForfeited = hoursUntil < cancHours;
  const depositAmt = r.commitment_fee_amount ?? Math.round((r.total_amount ?? 750) * 0.25);
  return {
    allowed: true, tooLate: false, feeForfeited,
    message: feeForfeited
      ? `You are within the ${cancHours}-hour cancellation window. Your 25% deposit of ${fmt(depositAmt)} will be retained by the store. Are you sure you want to cancel?`
      : "You can cancel this appointment for free. Would you like to proceed?",
  };
}

const CustomerReservations = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeTab, setActiveTab] = useState<BookingsTab>("upcoming");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [reviewTarget, setReviewTarget] = useState<Reservation | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<Reservation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] || "Customer";

  const fetchData = async () => {
    if (!user) return;
    const [resResult, reviewResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("*, stores(name, category, address, cancellation_hours), reservation_services(*)")
        .eq("customer_id", user.id)
        .order("reservation_date", { ascending: false }),
      supabase.from("reviews").select("reservation_id").eq("customer_id", user.id),
    ]);
    if (resResult.data) setReservations(resResult.data as unknown as Reservation[]);
    if (reviewResult.data) setReviewedIds(new Set(reviewResult.data.map((r) => r.reservation_id)));
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`customer-res-${user.id}`)
      .on("postgres_changes" as any, {
        event: "UPDATE", schema: "public", table: "reservations",
        filter: `customer_id=eq.${user.id}`,
      }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 70 && el.scrollTop === 0 && !refreshing) { setRefreshing(true); fetchData(); }
  };

  const handleCheckIn = async (r: Reservation) => {
    setCheckingIn(r.id);
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const { error } = await supabase
      .from("reservations")
      .update({ status: "arrived", checkin_code: code })
      .eq("id", r.id);
    setCheckingIn(null);
    if (error) { toast.error("Check-in failed. Please try again."); return; }
    setReservations((prev) =>
      prev.map((res) => res.id === r.id ? { ...res, status: "arrived", checkin_code: code } : res)
    );
    toast.success("Checked in! Show your code to the store.");
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const info = checkCancellation(cancelTarget);
    const svc = cancelTarget.reservation_services?.[0] ?? null;
    const totalAmount = cancelTarget.total_amount ?? (svc ? svc.subtotal : 750);
    const depositAmt = cancelTarget.commitment_fee_amount ?? Math.round(totalAmount * 0.25);
    const paymentFields = info.feeForfeited
      ? { payment_status: "partially_refunded", retained_amount: depositAmt, refund_amount: Math.max(0, totalAmount - depositAmt) }
      : { payment_status: "refunded", retained_amount: 0, refund_amount: totalAmount };
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled", cancelled_by: "customer", ...paymentFields })
      .eq("id", cancelTarget.id);
    if (error) {
      toast.error("Could not cancel. Please try again.");
    } else {
      setReservations((prev) =>
        prev.map((r) => r.id === cancelTarget.id ? { ...r, status: "cancelled", cancelled_by: "customer", ...paymentFields } : r)
      );
      toast.success(
        info.feeForfeited
          ? `Cancelled — ${fmt(paymentFields.refund_amount!)} will be refunded, ${fmt(depositAmt)} retained.`
          : "Appointment cancelled — full refund will be processed."
      );
    }
    setCancelling(false);
    setCancelTarget(null);
  };

  // Partition reservations into the 3 tab buckets
  const upcomingReservations = reservations
    .filter((r) => r.status === "scheduled" || r.status === "arrived" || r.status === "in_progress")
    .sort((a, b) => a.reservation_date.localeCompare(b.reservation_date)); // soonest first

  const historyReservations = reservations
    .filter((r) => r.status === "completed" || r.status === "no_show")
    .sort((a, b) => b.reservation_date.localeCompare(a.reservation_date));

  const cancelledReservations = reservations
    .filter((r) => r.status === "cancelled")
    .sort((a, b) => b.reservation_date.localeCompare(a.reservation_date));

  const filteredHistory = historyDateFilter
    ? historyReservations.filter((r) => r.reservation_date === historyDateFilter)
    : historyReservations;

  const cancelInfo = cancelTarget ? checkCancellation(cancelTarget) : null;

  const tabCounts = {
    upcoming: upcomingReservations.length,
    history: historyReservations.length,
    cancelled: cancelledReservations.length,
  };

  if (loading) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background px-5 pt-6" style={{ bottom: 56 }}>
        <h1 className="text-xl font-bold mb-4">My Bookings</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl booka-shimmer" />)}
        </div>
      </div>
    );
  }

  // ── Card rendering helpers ───────────────────────────────────────────────

  const renderUpcomingCard = (r: Reservation, i: number) => {
    const isToday = r.reservation_date === TODAY;
    const canCheckIn = r.status === "scheduled" && isToday;
    const canCancel = r.status === "scheduled";
    const svc = r.reservation_services?.[0] ?? null;
    const total = r.total_amount ?? (svc ? svc.subtotal : 750);
    const depositAmt = r.commitment_fee_amount ?? Math.round(total * 0.25);
    const emoji = getCategoryEmoji(r.stores?.category ?? "");
    const isActive = r.status === "scheduled" || r.status === "arrived";

    return (
      <div
        key={r.id}
        data-testid={`card-reservation-${r.id}`}
        className="rounded-2xl bg-card booka-shadow-sm card-stagger overflow-hidden"
        style={{ animationDelay: `${i * 55}ms` }}
      >
        {/* Card header */}
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-sm leading-tight truncate">{r.stores?.name || "Store"}</p>
              {r.stores?.category && <p className="text-[10px] text-muted-foreground">{r.stores.category}</p>}
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${statusColors[r.status] || "bg-muted text-muted-foreground"} ${isActive ? "pulse-badge" : ""}`}>
            {statusLabels[r.status] || r.status.replace("_", " ")}
          </span>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Date / time / address */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Calendar size={11} /> {format(parseISO(r.reservation_date), "EEEE, MMM d, yyyy")}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock size={11} /> {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
            </p>
            {r.stores?.address && (
              <p className="flex items-center gap-1.5">
                <MapPin size={11} /> {r.stores.address}
              </p>
            )}
          </div>

          {/* Service + price */}
          {svc ? (
            <div className="p-3 rounded-xl bg-secondary/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">{svc.service_name}</p>
                <p className="text-xs font-bold text-foreground">{fmt(svc.base_price)}</p>
              </div>
              {(svc.selected_options as any[]).map((opt, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                    {opt.group_label}: {opt.item_label}
                  </span>
                  <span>{opt.price_modifier > 0 ? `+${fmt(opt.price_modifier)}` : opt.price_modifier === 0 ? "Incl." : fmt(opt.price_modifier)}</span>
                </div>
              ))}
              <div className="border-t border-border/50 pt-1.5 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400">
                <span>Commitment deposit (25%)</span>
                <span>{fmt(depositAmt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Total charged</span>
                <span className="text-sm font-extrabold text-primary">{fmt(total)}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-secondary/50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600 dark:text-amber-400">Commitment deposit (25%)</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">{fmt(depositAmt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Total charged</span>
                <span className="text-sm font-extrabold text-primary">{fmt(total)}</span>
              </div>
            </div>
          )}

          {/* Arrived: show check-in code */}
          {r.status === "arrived" && r.checkin_code && (
            <div className="px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-center pop-in">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-300 mb-1">Your Check-In Code</p>
              <p className="text-3xl font-extrabold text-purple-700 dark:text-purple-200 tracking-[0.3em] font-mono">{r.checkin_code}</p>
              <p className="text-[10px] text-purple-500 dark:text-purple-400 mt-1">Show this to your service provider</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {canCheckIn && (
              <button
                data-testid={`button-checkin-${r.id}`}
                onClick={() => handleCheckIn(r)}
                disabled={checkingIn === r.id}
                className="w-full py-2.5 rounded-xl bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-purple-600 active:scale-[0.97] disabled:opacity-60"
              >
                <LogIn size={13} /> {checkingIn === r.id ? "Checking in…" : "Check In — I'm here!"}
              </button>
            )}
            {canCancel && (
              <button
                data-testid={`button-cancel-reservation-${r.id}`}
                onClick={() => setCancelTarget(r)}
                className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-red-50 active:scale-[0.97]"
              >
                <XCircle size={13} /> Cancel Appointment
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryCard = (r: Reservation, i: number) => {
    const svc = r.reservation_services?.[0] ?? null;
    const total = r.total_amount ?? (svc ? svc.subtotal : 750);
    const depositAmt = r.commitment_fee_amount ?? Math.round(total * 0.25);
    const emoji = getCategoryEmoji(r.stores?.category ?? "");

    return (
      <div
        key={r.id}
        data-testid={`card-history-${r.id}`}
        className="rounded-2xl bg-card booka-shadow-sm card-stagger overflow-hidden"
        style={{ animationDelay: `${i * 55}ms` }}
      >
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-sm leading-tight truncate">{r.stores?.name || "Store"}</p>
              {r.stores?.category && <p className="text-[10px] text-muted-foreground">{r.stores.category}</p>}
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${statusColors[r.status] || "bg-muted text-muted-foreground"}`}>
            {statusLabels[r.status] || r.status.replace("_", " ")}
          </span>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Calendar size={11} /> {format(parseISO(r.reservation_date), "EEEE, MMM d, yyyy")}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock size={11} /> {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
            </p>
          </div>

          {/* Service + options */}
          <div className="p-3 rounded-xl bg-secondary/50 space-y-1.5">
            {svc ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">{svc.service_name}</p>
                  <p className="text-xs font-bold text-foreground">{fmt(svc.base_price)}</p>
                </div>
                {(svc.selected_options as any[]).map((opt, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                      {opt.item_label}
                    </span>
                    <span>{opt.price_modifier > 0 ? `+${fmt(opt.price_modifier)}` : ""}</span>
                  </div>
                ))}
              </>
            ) : null}
            <div className="border-t border-border/50 pt-1.5 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400">
              <span>Commitment deposit (25%)</span>
              <span>{fmt(depositAmt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Total charged</span>
              <span className="text-sm font-extrabold text-primary">{fmt(total)}</span>
            </div>
          </div>

          {/* Payment outcome */}
          {r.status === "completed" && (
            <div className="px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                Payment complete · {fmt(total)} paid
              </p>
            </div>
          )}
          {r.status === "no_show" && r.refund_amount != null && r.retained_amount != null && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">No Show</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                {fmt(r.retained_amount)} retained by store · {fmt(r.refund_amount)} to be refunded
              </p>
            </div>
          )}

          <div className="space-y-2">
            {r.status === "completed" && !reviewedIds.has(r.id) && (
              <button
                onClick={() => setReviewTarget(r)}
                className="w-full py-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-amber-100 active:scale-[0.97]"
              >
                <Star size={13} /> Leave a Review
              </button>
            )}
            {r.status === "completed" && reviewedIds.has(r.id) && (
              <p className="text-xs text-green-600 text-center font-medium">✓ Review submitted</p>
            )}
            <button
              data-testid={`button-receipt-${r.id}`}
              onClick={() => setReceiptTarget(r)}
              className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-secondary active:scale-[0.97]"
            >
              <Receipt size={13} /> View Receipt
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCancelledCard = (r: Reservation, i: number) => {
    const svc = r.reservation_services?.[0] ?? null;
    const total = r.total_amount ?? (svc ? svc.subtotal : 750);
    const depositAmt = r.commitment_fee_amount ?? Math.round(total * 0.25);
    const emoji = getCategoryEmoji(r.stores?.category ?? "");
    const isCancelledByStore = r.cancelled_by === "store";

    return (
      <div
        key={r.id}
        data-testid={`card-cancelled-${r.id}`}
        className="rounded-2xl bg-card booka-shadow-sm card-stagger overflow-hidden opacity-90"
        style={{ animationDelay: `${i * 55}ms` }}
      >
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-sm leading-tight truncate">{r.stores?.name || "Store"}</p>
              {r.stores?.category && <p className="text-[10px] text-muted-foreground">{r.stores.category}</p>}
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 bg-red-400 text-white">
            Cancelled
          </span>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Calendar size={11} /> {format(parseISO(r.reservation_date), "EEEE, MMM d, yyyy")}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock size={11} /> {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
            </p>
          </div>

          {/* Cancellation notice */}
          <div className={`px-3 py-2.5 rounded-xl border ${
            isCancelledByStore
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
              : r.payment_status === "refunded"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
              : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-700"
          }`}>
            <p className={`text-xs font-semibold ${
              isCancelledByStore
                ? "text-blue-700 dark:text-blue-300"
                : r.payment_status === "refunded"
                ? "text-green-700 dark:text-green-300"
                : "text-red-600 dark:text-red-300"
            }`}>
              {isCancelledByStore ? "Appointment cancelled by store" : "Cancelled by You"}
            </p>
            {isCancelledByStore && r.refund_amount != null ? (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                Full refund of {fmt(r.refund_amount)} processed
              </p>
            ) : r.payment_status === "partially_refunded" && r.refund_amount != null && r.retained_amount != null ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {fmt(r.refund_amount)} refunded · {fmt(r.retained_amount)} retained as per cancellation policy
              </p>
            ) : r.payment_status === "refunded" && r.refund_amount != null ? (
              <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                Full refund of {fmt(r.refund_amount)} processed
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isCancelledByStore ? "Full refund will be processed" : `${fmt(depositAmt)} deposit retained`}
              </p>
            )}
          </div>

          <button
            data-testid={`button-receipt-cancelled-${r.id}`}
            onClick={() => setReceiptTarget(r)}
            className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-secondary active:scale-[0.97]"
          >
            <Receipt size={13} /> View Receipt
          </button>
        </div>
      </div>
    );
  };

  const TABS: { id: BookingsTab; label: string }[] = [
    { id: "upcoming", label: "Upcoming" },
    { id: "history", label: "History" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-x-0 top-0 overflow-y-auto bg-background slide-in-right"
      style={{ bottom: 56 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="px-5 pt-5 pb-0 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">My Bookings</h1>
          <button
            onClick={() => { setRefreshing(true); fetchData(); }}
            className={`p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all ${refreshing ? "animate-spin" : ""}`}
          >
            <RefreshCw size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-bookings-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 relative ${
                activeTab === tab.id
                  ? "bg-primary text-white booka-shadow-blue"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className={`ml-1 ${activeTab === tab.id ? "text-white/80" : "text-muted-foreground"}`}>
                  ({tabCounts[tab.id]})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="h-3" />
      </div>

      {refreshing && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Refreshing…
        </div>
      )}

      {/* ── UPCOMING TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "upcoming" && (
        <div key="upcoming" className="px-5 pt-4 pb-8 space-y-3 tab-fade">
          {upcomingReservations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-foreground">No upcoming bookings</p>
              <p className="text-xs mt-1 opacity-70">Your scheduled appointments will appear here</p>
            </div>
          ) : (
            upcomingReservations.map((r, i) => renderUpcomingCard(r, i))
          )}
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div key="history" className="px-5 pt-4 pb-8 space-y-3 tab-fade">
          {/* Date search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              data-testid="input-history-date-filter"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground outline-none focus:border-primary transition-colors"
            />
            {historyDateFilter && (
              <button
                onClick={() => setHistoryDateFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-foreground">
                {historyDateFilter ? "No bookings on this date" : "No completed bookings yet"}
              </p>
              <p className="text-xs mt-1 opacity-70">
                {historyDateFilter ? "Try a different date" : "Completed appointments will appear here"}
              </p>
            </div>
          ) : (
            filteredHistory.map((r, i) => renderHistoryCard(r, i))
          )}
        </div>
      )}

      {/* ── CANCELLED TAB ────────────────────────────────────────────────────── */}
      {activeTab === "cancelled" && (
        <div key="cancelled" className="px-5 pt-4 pb-8 space-y-3 tab-fade">
          {cancelledReservations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <XCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-foreground">No cancelled bookings</p>
              <p className="text-xs mt-1 opacity-70">Cancelled appointments will appear here</p>
            </div>
          ) : (
            cancelledReservations.map((r, i) => renderCancelledCard(r, i))
          )}
        </div>
      )}

      {reviewTarget && (
        <ReviewDialog
          reservation={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => { setReviewTarget(null); fetchData(); }}
        />
      )}

      {receiptTarget && (
        <ReceiptDialog
          open={!!receiptTarget}
          reservation={receiptTarget as any}
          customerName={displayName}
          service={receiptTarget.reservation_services?.[0] ?? null}
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {/* Cancellation dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
          </DialogHeader>
          {cancelInfo && (
            <div className="space-y-4 pt-1">
              {cancelInfo.tooLate ? (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100">
                  <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{cancelInfo.message}</p>
                </div>
              ) : (
                <>
                  {cancelInfo.feeForfeited && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">⚠️ Late Cancellation</p>
                      <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">{cancelInfo.message}</p>
                    </div>
                  )}
                  {!cancelInfo.feeForfeited && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{cancelInfo.message}</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCancelTarget(null)}>Keep Appointment</Button>
                    <Button
                      className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                      onClick={handleCancelConfirm}
                      disabled={cancelling}
                    >
                      {cancelling ? "Cancelling…" : "Yes, Cancel"}
                    </Button>
                  </div>
                </>
              )}
              {cancelInfo.tooLate && (
                <Button className="w-full rounded-xl" onClick={() => setCancelTarget(null)}>OK</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerReservations;
