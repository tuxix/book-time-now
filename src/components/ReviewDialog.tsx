import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  reservation: { id: string; store_id: string; stores: { name: string } | null };
  onClose: () => void;
  onSubmitted: () => void;
}

const ReviewDialog = ({ reservation, onClose, onSubmitted }: Props) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setLoading(true);
    try {
      const reviewerName =
        (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
        user.email?.split("@")[0] ||
        "Customer";

      const { error } = await supabase.from("reviews").insert({
        reservation_id: reservation.id,
        customer_id: user.id,
        store_id: reservation.store_id,
        rating,
        comment,
        reviewer_name: reviewerName,
      });
      if (error) throw error;
      toast.success("Review submitted!");
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-5 scale-in booka-shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground">Rate {reservation.stores?.name || "Store"}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary active:scale-95">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="transition-transform duration-150 active:scale-90"
            >
              <Star
                size={32}
                className={
                  n <= (hover || rating)
                    ? "text-amber-400 fill-amber-400"
                    : "text-border"
                }
              />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Tell us about your experience…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="rounded-xl resize-none"
          rows={3}
        />

        <Button
          className="w-full h-11 rounded-xl font-semibold"
          onClick={handleSubmit}
          disabled={rating === 0 || loading}
        >
          {loading ? "Submitting…" : "Submit Review"}
        </Button>
      </div>
    </div>
  );
};

export default ReviewDialog;
