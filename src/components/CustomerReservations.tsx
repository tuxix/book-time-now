import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Clock, MapPin, Star } from "lucide-react";
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
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const CustomerReservations = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reviewTarget, setReviewTarget] = useState<Reservation | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
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
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <h1 className="text-xl font-bold mb-4">My Bookings</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-xl font-bold mb-4 fade-in">My Bookings</h1>

      {reservations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No bookings yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r, i) => (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-card booka-shadow-sm slide-up"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-foreground text-sm">{r.stores?.name || "Store"}</p>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    statusColors[r.status] || "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.status.replace("_", " ")}
                </span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {format(parseISO(r.reservation_date), "MMM d, yyyy")}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock size={12} />
                  {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                </p>
                {r.stores?.address && (
                  <p className="flex items-center gap-1.5">
                    <MapPin size={12} /> {r.stores.address}
                  </p>
                )}
              </div>

              {r.status === "completed" && !reviewedIds.has(r.id) && (
                <button
                  onClick={() => setReviewTarget(r)}
                  className="mt-3 w-full py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-amber-100 active:scale-[0.97]"
                >
                  <Star size={14} /> Leave a Review
                </button>
              )}

              {r.status === "completed" && reviewedIds.has(r.id) && (
                <p className="mt-2 text-xs text-muted-foreground text-center">✓ Review submitted</p>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewTarget && (
        <ReviewDialog
          reservation={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            setReviewTarget(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default CustomerReservations;
