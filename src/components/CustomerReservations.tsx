import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Clock, MapPin, Star, RefreshCw, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import ReviewDialog from "@/components/ReviewDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Reservation {
  id: string;
  store_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  fee: number;
  stores: {
    name: string;
    address: string;
    cancellation_hours?: number;
    commitment_fee?: number;
  } | null;
}

const statusColors: Record<string, string> = {
  scheduled:   "bg-blue-500 text-white",
  in_progress: "bg-orange-500 text-white",
  completed:   "bg-green-500 text-white",
  cancelled:   "bg-red-400 text-white",
};

function checkCancellation(r: Reservation): {
  allowed: boolean;
  tooLate: boolean;
  feeForfeited: boolean;
  message: string;
} {
  const now = new Date();
  const apptDateTime = new Date(`${r.reservation_date}T${r.start_time}`);
  const hoursUntil = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 1) {
    return {
      allowed: false,
      tooLate: true,
      feeForfeited: false,
      message: "It is too late to cancel this appointment. Please contact the store directly.",
    };
  }

  const cancHours = r.stores?.cancellation_hours ?? 24;
  const feeForfeited = hoursUntil < cancHours;
  const fee = r.stores?.commitment_fee ?? 750;

  return {
    allowed: true,
    tooLate: false,
    feeForfeited,
    message: feeForfeited
      ? `You are within the ${cancHours}-hour cancellation window. Your commitment fee of J$${fee.toFixed(0)} will not be refunded. Are you sure you want to cancel?`
      : `You can cancel this appointment for free. Would you like to proceed?`,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const fetchData = async () => {
    if (!user) return;
    const [resResult, reviewResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("*, stores(name, address, cancellation_hours, commitment_fee)")
        .eq("customer_id", user.id)
        .order("reservation_date", { ascending: false }),
      supabase
        .from("reviews")
        .select("reservation_id")
        .eq("customer_id", user.id),
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

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", cancelTarget.id);
    if (error) {
      toast.error("Could not cancel. Please try again.");
    } else {
      setReservations((prev) =>
        prev.map((r) => r.id === cancelTarget.id ? { ...r, status: "cancelled" } : r)
      );
      toast.success("Appointment cancelled.");
    }
    setCancelling(false);
    setCancelTarget(null);
  };

  const sorted = [...reservations].sort((a, b) => {
    if (a.status === "cancelled" && b.status !== "cancelled") return 1;
    if (a.status !== "cancelled" && b.status === "cancelled") return -1;
    return b.reservation_date.localeCompare(a.reservation_date);
  });

  const cancelInfo = cancelTarget ? checkCancellation(cancelTarget) : null;

  if (loading) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background px-5 pt-6" style={{ bottom: 56 }}>
        <h1 className="text-xl font-bold mb-4">My Bookings</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="absolute inset-x-0 top-0 overflow-y-auto bg-background"
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
              const canCancel = r.status === "scheduled" || r.status === "in_progress";
              return (
                <div
                  key={r.id}
                  data-testid={`card-reservation-${r.id}`}
                  className={`p-4 rounded-2xl bg-card booka-shadow-sm slide-up ${r.status === "cancelled" ? "opacity-70" : ""}`}
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-foreground text-sm">{r.stores?.name || "Store"}</p>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColors[r.status] || "bg-muted text-muted-foreground"}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Calendar size={11} /> {format(parseISO(r.reservation_date), "MMM d, yyyy")}
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

                  {r.status === "cancelled" && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">
                        This appointment was cancelled. Please rebook at your convenience.
                      </p>
                    </div>
                  )}

                  {r.status === "completed" && !reviewedIds.has(r.id) && (
                    <button
                      onClick={() => setReviewTarget(r)}
                      className="mt-3 w-full py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-amber-100 active:scale-[0.97]"
                    >
                      <Star size={13} /> Leave a Review
                    </button>
                  )}
                  {r.status === "completed" && reviewedIds.has(r.id) && (
                    <p className="mt-2 text-xs text-green-600 text-center font-medium">✓ Review submitted</p>
                  )}

                  {canCancel && (
                    <button
                      data-testid={`button-cancel-reservation-${r.id}`}
                      onClick={() => setCancelTarget(r)}
                      className="mt-3 w-full py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-red-50 active:scale-[0.97]"
                    >
                      <XCircle size={13} /> Cancel Appointment
                    </button>
                  )}
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
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setCancelTarget(null)}
                    >
                      Keep Appointment
                    </Button>
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
                <Button className="w-full rounded-xl" onClick={() => setCancelTarget(null)}>
                  OK
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerReservations;
