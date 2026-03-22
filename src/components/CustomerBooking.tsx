import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Star, MapPin, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

interface Store {
  id: string;
  name: string;
  description: string;
  address: string;
  category: string;
  rating: number;
  review_count: number;
  image: string;
}

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Props {
  store: Store;
  onBack: () => void;
}

const CustomerBooking = ({ store, onBack }: Props) => {
  const { user } = useAuth();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [takenSlotIds, setTakenSlotIds] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const dayOfWeek = dates[selectedDate].getDay();
  const selectedDateStr = format(dates[selectedDate], "yyyy-MM-dd");

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);

    Promise.all([
      supabase
        .from("store_time_slots")
        .select("*")
        .eq("store_id", store.id)
        .eq("day_of_week", dayOfWeek)
        .eq("is_available", true),
      supabase
        .from("reservations")
        .select("start_time, end_time")
        .eq("store_id", store.id)
        .eq("reservation_date", selectedDateStr)
        .neq("status", "cancelled"),
    ]).then(([slotsRes, reservationsRes]) => {
      const availableSlots = (slotsRes.data ?? []) as TimeSlot[];
      setSlots(availableSlots);

      const taken = new Set<string>();
      const takenTimes = (reservationsRes.data ?? []).map((r) => `${r.start_time}-${r.end_time}`);
      availableSlots.forEach((s) => {
        if (takenTimes.includes(`${s.start_time}-${s.end_time}`)) {
          taken.add(s.id);
        }
      });
      setTakenSlotIds(taken);
      setLoadingSlots(false);
    });
  }, [store.id, dayOfWeek, selectedDateStr]);

  const handleBook = async () => {
    const slot = slots.find((s) => s.id === selectedSlot);
    if (!slot || !user) return;
    setBooking(true);
    try {
      // Double-booking check
      const { data: existing } = await supabase
        .from("reservations")
        .select("id")
        .eq("store_id", store.id)
        .eq("reservation_date", selectedDateStr)
        .eq("start_time", slot.start_time)
        .eq("end_time", slot.end_time)
        .neq("status", "cancelled")
        .maybeSingle();

      if (existing) {
        toast.error("That slot was just taken. Please choose another time.");
        setTakenSlotIds((prev) => new Set([...prev, slot.id]));
        setSelectedSlot(null);
        return;
      }

      const { error } = await supabase.from("reservations").insert({
        customer_id: user.id,
        store_id: store.id,
        reservation_date: selectedDateStr,
        start_time: slot.start_time,
        end_time: slot.end_time,
      });
      if (error) throw error;
      setConfirmed(true);
      toast.success("Reservation booked!");
    } catch (err: any) {
      toast.error(err.message || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4 fade-in">
          <CheckCircle2 size={64} className="mx-auto text-green-500" />
          <h1 className="text-2xl font-bold">Booked!</h1>
          <p className="text-muted-foreground text-sm">
            Your reservation at <span className="font-semibold">{store.name}</span> is confirmed.
          </p>
          <Button className="rounded-xl px-8" onClick={onBack}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-foreground">{store.name}</h1>
      </div>

      <div className="px-5 pt-4 space-y-6">
        {/* Store info */}
        <div className="flex items-start gap-4 fade-in">
          <div className="w-16 h-16 rounded-2xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
            {store.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            {(store.rating > 0 || store.review_count > 0) && (
              <div className="flex items-center gap-2">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium">{store.rating || "New"}</span>
                {store.review_count > 0 && (
                  <span className="text-xs text-muted-foreground">({store.review_count} reviews)</span>
                )}
              </div>
            )}
            {store.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin size={12} /> {store.address}
              </p>
            )}
            {store.description && (
              <p className="text-xs text-muted-foreground">{store.description}</p>
            )}
          </div>
        </div>

        {/* Date picker */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Select Date</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((d, i) => (
              <button
                key={i}
                onClick={() => { setSelectedDate(i); setSelectedSlot(null); }}
                className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[56px] transition-all duration-200 active:scale-95 ${
                  selectedDate === i
                    ? "bg-primary text-primary-foreground booka-shadow"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <span className="text-xs">{format(d, "EEE")}</span>
                <span className="text-lg font-bold">{format(d, "d")}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time slots */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Available Slots</h2>
          {loadingSlots ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No available slots for this day
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => {
                const isTaken = takenSlotIds.has(slot.id);
                const isSelected = selectedSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => !isTaken && setSelectedSlot(slot.id)}
                    disabled={isTaken}
                    className={`py-3 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.97] ${
                      isTaken
                        ? "bg-muted text-muted-foreground cursor-not-allowed line-through"
                        : isSelected
                        ? "bg-primary text-primary-foreground booka-shadow"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {isTaken ? <AlertCircle size={14} /> : <Clock size={14} />}
                    {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-md border-t border-border">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Commitment Fee</span>
              <span className="font-bold text-foreground">J$750</span>
            </div>
            <Button
              className="w-full h-12 rounded-xl font-semibold"
              onClick={handleBook}
              disabled={booking}
            >
              {booking ? "Booking..." : "Confirm Reservation"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerBooking;
