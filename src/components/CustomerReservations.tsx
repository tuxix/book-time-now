import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar, Clock, MapPin, Star, RefreshCw, XCircle, LogIn, Receipt,
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
  checkin_code?: string;
  cancelled_by?: string;
  stores: {
    name: string;
    category?: string;
    address: string;
    cancellation_hours?: number;
    commitment_fee?: number;
  } | null;
  reservation_services?: ReservationServiceData[];
}

const TODAY = format(new Date(), "yyyy-MM-dd");

const statusColors: Record<string, string> = {
  scheduled:   "bg-blue-500 text-white",
  arrived:     "bg-purple-500 text-white",
  in_progress: "bg-orange-500 text-white",
  completed:   "bg-green-500 text-white",
  cancelled:   "bg-red-400 text-white",
};

const statusLabels: Record<string, string> = {
  scheduled:   "Scheduled",
  arrived:     "Arrived",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
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
  const fee = r.stores?.commitment_fee ?? 750;
  return {
    allowed: true, tooLate: false, feeForfeited,
    message: feeForfeited
      ? `You are within the ${cancHours}-hour cancellation window. Your commitment fee of ${fmt(fee)} will not be refunded. Are you sure you want to cancel?`
      : "You can cancel this appointment for free. Would you like to proceed?",
  };
}

const CustomerReservations = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
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
        .select("*, stores(name, category, address, cancellation_hours, commitment_fee), reservation_services(*)")
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
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled", cancelled_by: "customer" })
      .eq("id", cancelTarget.id);
    if (error) {
      toast.error("Could not cancel. Please try again.");
    } else {
      setReservations((prev) =>
        prev.map((r) => r.id === cancelTarget.id ? { ...r, status: "cancelled", cancelled_by: "customer" } : r)
      );
      toast.success("Appointment cancelled.");
    }
    setCancelling(false);
    setCancelTarget(null);
  };

  const sorted = [...reservations].sort((a, b) => {
    const aActive = a.status !== "cancelled" && a.status !== "completed";
    const bActive = b.status !== "cancelled" && b.status !== "completed";
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return b.reservation_date.localeCompare(a.reservation_date);
  });

  const cancelInfo = cancelTarget ? checkCancellation(cancelTarget) : null;

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

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-x-0 top-0 overflow-y-auto bg-background slide-in-right"
      style={{ bottom: 56 }}
    >
      <div className="px-5 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold fade-in">My Bookings</h1>
          <button
            onClick={() => { setRefreshing(true); fetchData(); }}
            className={`p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all ${refreshing ? "animate-spin" : ""}`}
          >
            <RefreshCw size={16} className="text-muted-foreground" />
          </button>
        </div>

        {refreshing && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Refreshing…
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No bookings yet</p>
            <p className="text-xs mt-1 opacity-70">Your reservations will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((r, i) => {
              const isToday = r.reservation_date === TODAY;
              const canCheckIn = r.status === "scheduled" && isToday;
              const canCancel = r.status === "scheduled";
              const isCancelledByStore = r.status === "cancelled" && r.cancelled_by === "store";
              const isDone = r.status === "completed" || r.status === "cancelled";
              const svc = r.reservation_services?.[0] ?? null;
              const commitmentFee = r.stores?.commitment_fee ?? 750;
              const total = svc ? svc.subtotal + commitmentFee : commitmentFee;
              const emoji = getCategoryEmoji(r.stores?.category ?? "");

              return (
                <div
                  key={r.id}
                  data-testid={`card-reservation-${r.id}`}
                  className={`rounded-2xl bg-card booka-shadow-sm slide-up overflow-hidden ${r.status === "cancelled" ? "opacity-80" : ""}`}
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                >
                  {/* Card header: store + status */}
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

                  <div className="px-4 pb-3 space-y-3">
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

                    {/* Service + options + price breakdown */}
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
                        <div className="border-t border-border/50 pt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Commitment fee</span>
                          <span>+{fmt(commitmentFee)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">Total paid</span>
                          <span className="text-sm font-extrabold text-primary">{fmt(total)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-secondary/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Commitment fee</span>
                        <span className="text-sm font-extrabold text-primary">{fmt(commitmentFee)}</span>
                      </div>
                    )}

                    {/* Arrived: show check-in code */}
                    {r.status === "arrived" && r.checkin_code && (
                      <div className="px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-center">
                        <p className="text-xs font-semibold text-purple-600 dark:text-purple-300 mb-1">Your Check-In Code</p>
                        <p className="text-3xl font-extrabold text-purple-700 dark:text-purple-200 tracking-[0.3em] font-mono">{r.checkin_code}</p>
                        <p className="text-[10px] text-purple-500 dark:text-purple-400 mt-1">Show this to your service provider</p>
                      </div>
                    )}

                    {/* Cancelled notice */}
                    {r.status === "cancelled" && (
                      <div className={`px-3 py-2 rounded-xl border ${isCancelledByStore ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700" : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800"}`}>
                        <p className={`text-xs font-medium text-center ${isCancelledByStore ? "text-orange-700 dark:text-orange-300" : "text-red-600 dark:text-red-400"}`}>
                          {isCancelledByStore
                            ? `Your appointment at ${r.stores?.name || "the store"} was cancelled by the store.`
                            : "This appointment was cancelled."}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-2">
                      {r.status === "completed" && !reviewedIds.has(r.id) && (
                        <button
                          onClick={() => setReviewTarget(r)}
                          className="w-full py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-amber-100 active:scale-[0.97]"
                        >
                          <Star size={13} /> Leave a Review
                        </button>
                      )}
                      {r.status === "completed" && reviewedIds.has(r.id) && (
                        <p className="text-xs text-green-600 text-center font-medium">✓ Review submitted</p>
                      )}

                      {isDone && (
                        <button
                          data-testid={`button-receipt-${r.id}`}
                          onClick={() => setReceiptTarget(r)}
                          className="w-full py-2 rounded-xl border border-border text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-secondary active:scale-[0.97]"
                        >
                          <Receipt size={13} /> View Receipt
                        </button>
                      )}

                      {canCheckIn && (
                        <button
                          data-testid={`button-checkin-${r.id}`}
                          onClick={() => handleCheckIn(r)}
                          disabled={checkingIn === r.id}
                          className="w-full py-2 rounded-xl bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-purple-600 active:scale-[0.97] disabled:opacity-60"
                        >
                          <LogIn size={13} /> {checkingIn === r.id ? "Checking in…" : "Check In — I'm here!"}
                        </button>
                      )}

                      {canCancel && (
                        <button
                          data-testid={`button-cancel-reservation-${r.id}`}
                          onClick={() => setCancelTarget(r)}
                          className="w-full py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-red-50 active:scale-[0.97]"
                        >
                          <XCircle size={13} /> Cancel Appointment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
