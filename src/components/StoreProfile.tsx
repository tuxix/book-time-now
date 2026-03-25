import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Star, MapPin, Phone, Clock, MessageSquare, Heart, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getCategoryEmoji, distanceKm, timeAgo } from "@/lib/categories";
import { toast } from "sonner";

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
  accepting_bookings?: boolean;
  commitment_fee?: number;
  cancellation_hours?: number;
  announcement?: string;
  avatar_url?: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name?: string;
  store_reply?: string;
  store_reply_at?: string;
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const REPORT_REASONS = ["Inappropriate content", "Fake listing", "Wrong information", "Other"];

interface Props {
  store: Store;
  userLocation: [number, number] | null;
  onBack: () => void;
  onBook: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
}

const StoreProfile = ({ store, userLocation, onBack, onBook, isFav, onToggleFav }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [liveRating, setLiveRating] = useState({ rating: store.rating, count: store.review_count });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

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

  const submitReport = async () => {
    if (!user) return;
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from("store_reports").insert({
        store_id: store.id,
        customer_id: user.id,
        reason: reportReason,
      });
      if (error) throw error;
      setReportSubmitted(true);
    } catch {
      toast.error("Could not submit report. Please try again.");
    }
    setSubmittingReport(false);
  };

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

  const Avatar = ({ size = "w-16 h-16" }: { size?: string }) => store.avatar_url ? (
    <img src={store.avatar_url} alt={store.name}
      className={`${size} rounded-2xl object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-2xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0`}>
      {store.name.slice(0, 2).toUpperCase()}
    </div>
  );

  return (
    <div className="absolute inset-x-0 top-0 overflow-y-auto bg-background slide-in-right" style={{ bottom: 56, zIndex: 300 }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-2">
        <button onClick={onBack} data-testid="button-back-profile"
          className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-foreground truncate flex-1">{store.name}</h1>
        {onToggleFav !== undefined && (
          <button
            data-testid="button-toggle-fav"
            onClick={onToggleFav}
            className="p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all"
          >
            <Heart
              size={20}
              className={isFav ? "text-red-500" : "text-muted-foreground"}
              fill={isFav ? "currentColor" : "none"}
            />
          </button>
        )}
      </div>

      {/* Announcement banner */}
      {!!store.announcement && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
          <span className="text-lg leading-none mt-0.5">📢</span>
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium leading-relaxed">{store.announcement}</p>
        </div>
      )}

      {/* Hero card */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-4">
          <Avatar />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground leading-tight">{store.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{emoji} {store.category}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {!store.is_open && (
                <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">CLOSED</span>
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
          {(store.cancellation_hours ?? 0) > 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock size={14} className="text-green-500 shrink-0" />
              Free cancellation up to {store.cancellation_hours} hour{store.cancellation_hours! > 1 ? "s" : ""} before your appointment
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
      <div className="px-5 py-4 pb-36">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageSquare size={16} className="text-primary" />
          Reviews
          {liveRating.count > 0 && (
            <span className="text-xs text-muted-foreground ml-1">({liveRating.count})</span>
          )}
        </h3>
        {loadingReviews ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl booka-shimmer" />)}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reviews yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => {
              const name = review.reviewer_name || "Customer";
              const initials = name.slice(0, 2).toUpperCase();
              return (
                <div key={review.id} className="p-4 rounded-2xl bg-card booka-shadow-sm border border-border/50">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full booka-gradient flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground truncate">{name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{timeAgo(review.created_at)}</span>
                      </div>
                      <Stars rating={review.rating} />
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground leading-relaxed pl-11">{review.comment}</p>
                  )}
                  {review.store_reply && (
                    <div className="mt-3 ml-11 pl-3 border-l-2 border-primary/25 bg-primary/[0.03] rounded-r-lg py-2 pr-2">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Owner Reply</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{review.store_reply}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Report link */}
        <div className="mt-6 pt-4 border-t border-border">
          <button
            data-testid="button-report-store"
            onClick={() => { setReportOpen(true); setReportSubmitted(false); setReportReason(REPORT_REASONS[0]); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Flag size={12} /> Report this store
          </button>
        </div>
      </div>

      {/* Fixed Book Now */}
      <div className="fixed inset-x-0 p-4 bg-card/95 backdrop-blur-md border-t border-border" style={{ bottom: 56, zIndex: 310 }}>
        <div className="max-w-lg mx-auto">
          {store.accepting_bookings === false ? (
            <Button
              data-testid="button-not-accepting"
              className="w-full h-12 rounded-xl font-semibold text-base bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
              disabled
            >
              Not Taking Bookings Right Now
            </Button>
          ) : (
            <Button
              data-testid="button-book-now"
              className="w-full h-12 rounded-xl font-semibold text-base booka-gradient text-white border-0 booka-cta-pulse"
              onClick={onBook}
            >
              {!store.is_open ? "Book in Advance" : "Book Now"}
            </Button>
          )}
          {(store.commitment_fee ?? 0) > 0 && store.accepting_bookings !== false && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              J${(store.commitment_fee!).toFixed(0)} commitment fee · applied to your final service price
            </p>
          )}
        </div>
      </div>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={(o) => { if (!o) setReportOpen(false); }}>
        <DialogContent className="max-w-sm rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Report Store</DialogTitle>
          </DialogHeader>
          {reportSubmitted ? (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Flag size={20} className="text-green-600" />
              </div>
              <p className="font-semibold text-foreground">Thank you for your report</p>
              <p className="text-sm text-muted-foreground">We will review this store and take appropriate action.</p>
              <Button className="w-full rounded-xl" onClick={() => setReportOpen(false)}>Done</Button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <p className="text-sm text-muted-foreground">Select a reason for your report:</p>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                      reportReason === reason
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <Button
                className="w-full rounded-xl"
                onClick={submitReport}
                disabled={submittingReport}
              >
                {submittingReport ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreProfile;
