import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, MapPin, Phone, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCategoryEmoji, distanceKm, timeAgo } from "@/lib/categories";

export interface Store {
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

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name?: string;
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  store: Store;
  userLocation: [number, number] | null;
  onBack: () => void;
  onBook: () => void;
}

const StoreProfile = ({ store, userLocation, onBack, onBook }: Props) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [liveRating, setLiveRating] = useState({ rating: store.rating, count: store.review_count });

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (data) {
      setReviews(data as Review[]);
      if (data.length > 0) {
        const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
        setLiveRating({ rating: Math.round(avg * 10) / 10, count: data.length });
      }
    }
    setLoadingReviews(false);
  };

  useEffect(() => {
    fetchReviews();
    supabase
      .from("store_time_slots")
      .select("id, day_of_week, start_time, end_time")
      .eq("store_id", store.id)
      .eq("is_available", true)
      .order("day_of_week")
      .order("start_time")
      .then(({ data }) => { if (data) setSlots(data as TimeSlot[]); });

    const channel = supabase
      .channel(`store-reviews-${store.id}`)
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "reviews", filter: `store_id=eq.${store.id}`,
      }, () => fetchReviews())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store.id]);

  const dist = distanceKm(userLocation?.[0] ?? null, userLocation?.[1] ?? null, store.latitude, store.longitude);
  const emoji = getCategoryEmoji(store.category);

  const groupedSlots = DAYS.reduce<Record<string, TimeSlot[]>>((acc, day, i) => {
    const ds = slots.filter((s) => s.day_of_week === i);
    if (ds.length > 0) acc[day] = ds;
    return acc;
  }, {});

  const Stars = ({ rating, size = 13 }: { rating: number; size?: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size}
          className={n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-border"} />
      ))}
    </div>
  );

  return (
    <div className="absolute inset-x-0 top-0 overflow-y-auto bg-background fade-in" style={{ bottom: 56, zIndex: 300 }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} data-testid="button-back-profile"
          className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-foreground truncate">{store.name}</h1>
      </div>

      {/* Hero card */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0">
            {store.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground leading-tight">{store.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{emoji} {store.category}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {!store.is_open && (
                <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                  CLOSED
                </span>
              )}
              {liveRating.count > 0 ? (
                <>
                  <Stars rating={liveRating.rating} />
                  <span className="text-xs text-muted-foreground">
                    {liveRating.rating} ({liveRating.count} {liveRating.count === 1 ? "review" : "reviews"})
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">New · No reviews yet</span>
              )}
              {dist && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <MapPin size={10} /> {dist}
                </span>
              )}
            </div>
          </div>
        </div>
        {store.description && (
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{store.description}</p>
        )}
        <div className="mt-3 space-y-1.5">
          {store.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin size={14} className="text-primary shrink-0" /> {store.address}
            </p>
          )}
          {store.phone && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Phone size={14} className="text-primary shrink-0" /> {store.phone}
            </p>
          )}
        </div>
      </div>

      <div className="h-2 bg-secondary" />

      {/* Available hours */}
      {Object.keys(groupedSlots).length > 0 && (
        <div className="px-5 py-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock size={16} className="text-primary" /> Available Hours
          </h3>
          <div className="space-y-2">
            {Object.entries(groupedSlots).map(([day, ds]) => (
              <div key={day} className="flex items-start gap-3">
                <span className="text-xs font-medium text-muted-foreground w-8 pt-0.5 shrink-0">{day}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ds.map((s) => (
                    <span key={s.id} className="text-xs bg-primary/10 text-primary font-medium px-2 py-1 rounded-lg">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-2 bg-secondary" />

      {/* Reviews */}
      <div className="px-5 py-4 pb-32">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageSquare size={16} className="text-primary" />
          Reviews
          {liveRating.count > 0 && (
            <span className="text-xs text-muted-foreground ml-1">({liveRating.count})</span>
          )}
        </h3>
        {loadingReviews ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-secondary animate-pulse" />)}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reviews yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 rounded-xl bg-card booka-shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-foreground">
                    {review.reviewer_name || "Customer"}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</span>
                </div>
                <Stars rating={review.rating} />
                {review.comment && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Book Now */}
      <div className="fixed inset-x-0 p-4 bg-card/95 backdrop-blur-md border-t border-border" style={{ bottom: 56, zIndex: 310 }}>
        <div className="max-w-lg mx-auto">
          {store.is_open ? (
            <Button data-testid="button-book-now" className="w-full h-12 rounded-xl font-semibold text-base" onClick={onBook}>
              Book Now
            </Button>
          ) : (
            <Button
              data-testid="button-store-closed"
              className="w-full h-12 rounded-xl font-semibold text-base bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
              disabled
            >
              Store Currently Closed
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreProfile;
