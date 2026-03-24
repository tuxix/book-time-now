import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Clock, MapPin, Star, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import ReviewDialog from "@/components/ReviewDialog";

interface Reservation {
  id: string;
  store_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  fee: number;
  stores: { name: string; address: string } | null;
}

const statusColors: Record<string, string> = {
  scheduled:   "bg-blue-500 text-white",
  in_progress: "bg-orange-500 text-white",
  completed:   "bg-green-500 text-white",
  cancelled:   "bg-red-400 text-white",
};

const CustomerReservations = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reviewTarget, setReviewTarget] = useState<Reservation | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const fetchData = async () => {
    if (!user) return;
    const [resResult, reviewResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("*, stores(name, address)")
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

  // Realtime subscription for reservation status updates
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

  // Pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 70 && el.scrollTop === 0 && !refreshing) {
      setRefreshing(true);
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background px-5 pt-6" style={{ bottom: 56 }}>
        <h1 className="text-xl font-bold mb-4">My Bookings</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-secondary animate-pulse" />)}
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

        {reservations.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No bookings yet</p>
            <p className="text-xs mt-1 opacity-70">Your reservations will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((r, i) => (
              <div
                key={r.id}
                data-testid={`card-reservation-${r.id}`}
                className="p-4 rounded-2xl bg-card booka-shadow-sm slide-up"
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
              </div>
            ))}
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
    </div>
  );
};

export default CustomerReservations;
