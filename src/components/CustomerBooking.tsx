import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Star, MapPin, Clock, CheckCircle2, AlertCircle,
  Calendar, ChevronDown, CreditCard, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { type Store } from "@/components/StoreProfile";
import CustomerCalendar from "@/components/CustomerCalendar";

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface ConfirmedDetails {
  date: string;
  startTime: string;
  endTime: string;
  ref: string;
}

interface Props {
  store: Store;
  onBack: () => void;
}

const CustomerBooking = ({ store, onBack }: Props) => {
  const { user } = useAuth();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [takenSlotIds, setTakenSlotIds] = useState<Set<string>>(new Set());
  const [existingBookings, setExistingBookings] = useState<{ start_time: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedDetails | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState(false);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const activeDateObj = calendarDate ? new Date(calendarDate + "T00:00:00") : dates[selectedDate];
  const dayOfWeek = activeDateObj.getDay();
  const selectedDateStr = calendarDate ?? format(dates[selectedDate], "yyyy-MM-dd");

  const timeToMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const getWaitCount = (slot: TimeSlot) => {
    const slotStart = timeToMins(slot.start_time);
    return existingBookings.filter((b) => timeToMins(b.start_time) < slotStart).length;
  };

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setPaymentStep(false);

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
      const bookings = (reservationsRes.data ?? []) as { start_time: string; end_time: string }[];
      setSlots(availableSlots);
      setExistingBookings(bookings);

      const buffer = store.buffer_minutes ?? 0;
      const taken = new Set<string>();
      availableSlots.forEach((slot) => {
        const slotStart = timeToMins(slot.start_time);
        const slotEnd = timeToMins(slot.end_time);
        for (const b of bookings) {
          const bookingStart = timeToMins(b.start_time);
          const bookingEnd = timeToMins(b.end_time) + buffer;
          if (slotStart < bookingEnd && slotEnd > bookingStart) {
            taken.add(slot.id);
            break;
          }
        }
      });
      setTakenSlotIds(taken);
      setLoadingSlots(false);
    });
  }, [store.id, store.buffer_minutes, dayOfWeek, selectedDateStr, calendarDate]);

  const handleBook = async () => {
    const slot = slots.find((s) => s.id === selectedSlot);
    if (!slot || !user) return;
    setBooking(true);
    try {
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
        setPaymentStep(false);
        return;
      }

      const { data: inserted, error } = await supabase
        .from("reservations")
        .insert({
          customer_id: user.id,
          store_id: store.id,
          reservation_date: selectedDateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
        })
        .select("id")
        .single();

      if (error) throw error;

      setPaymentStep(false);
      setConfirmed({
        date: format(activeDateObj, "MMMM d, yyyy"),
        startTime: slot.start_time.slice(0, 5),
        endTime: slot.end_time.slice(0, 5),
        ref: (inserted?.id as string)?.split("-")[0]?.toUpperCase() ?? "—",
      });
    } catch (err: any) {
      toast.error(err.message || "Booking failed. Please try again.");
      setPaymentStep(false);
    } finally {
      setBooking(false);
    }
  };

  const selectedSlotObj = slots.find((s) => s.id === selectedSlot);
  const commitmentFee = store.commitment_fee ?? 750;

  // ── Confirmed screen ──────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background flex flex-col items-center justify-center px-6 fade-in" style={{ bottom: 56, zIndex: 400 }}>
        <div className="w-full max-w-xs text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={42} className="text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Booking Confirmed!</h1>
            <p className="text-sm text-muted-foreground mt-1">Your reservation is all set.</p>
          </div>
          <div className="p-5 rounded-2xl bg-card booka-shadow text-left space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Store</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{store.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" /> {confirmed.date}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Time</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                <Clock size={13} className="text-primary" /> {confirmed.startTime} – {confirmed.endTime}
              </p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Booking Reference</p>
              <p className="text-xl font-bold text-primary font-mono tracking-widest mt-0.5">#{confirmed.ref}</p>
            </div>
          </div>
          <Button className="w-full rounded-xl h-12 font-semibold" onClick={onBack}>Done</Button>
        </div>
      </div>
    );
  }

  // ── Payment confirmation step ──────────────────────────────────────────────
  if (paymentStep && selectedSlotObj) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background flex flex-col items-center justify-center px-6 fade-in" style={{ bottom: 56, zIndex: 410 }}>
        <div className="w-full max-w-xs text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CreditCard size={30} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Confirm Your Booking</h1>
            <p className="text-sm text-muted-foreground mt-1">Review the details below</p>
          </div>
          <div className="p-5 rounded-2xl bg-card booka-shadow text-left space-y-3 w-full">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Store</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{store.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {format(activeDateObj, "MMMM d, yyyy")} · {selectedSlotObj.start_time.slice(0, 5)} – {selectedSlotObj.end_time.slice(0, 5)}
              </p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Commitment Fee</p>
              <p className="text-2xl font-bold text-primary mt-0.5">J${commitmentFee.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                This deposit will be deducted from your final service price at the store.
              </p>
            </div>
          </div>
          <Button
            data-testid="button-confirm-pay"
            className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
            onClick={handleBook}
            disabled={booking}
          >
            {booking ? "Processing…" : "Confirm & Pay  →"}
          </Button>
          <button
            onClick={() => setPaymentStep(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Main booking screen ────────────────────────────────────────────────────
  return (
    <div className="absolute inset-x-0 top-0 bg-background overflow-y-auto" style={{ bottom: 56, zIndex: 400, paddingBottom: 96 }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-foreground">{store.name}</h1>
      </div>

      <div className="px-5 pt-4 space-y-6">
        {/* Store info */}
        <div className="flex items-start gap-4 fade-in">
          {store.avatar_url ? (
            <img src={store.avatar_url} alt={store.name}
              className="w-14 h-14 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-2xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-base shrink-0">
              {store.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="space-y-1">
            {(store.rating > 0 || store.review_count > 0) && (
              <div className="flex items-center gap-1.5">
                <Star size={13} className="text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium">{store.rating || "New"}</span>
                {store.review_count > 0 && (
                  <span className="text-xs text-muted-foreground">({store.review_count})</span>
                )}
              </div>
            )}
            {store.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin size={11} /> {store.address}
              </p>
            )}
            {store.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{store.description}</p>
            )}
          </div>
        </div>

        {/* Date picker */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Select Date</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {dates.map((d, i) => (
              <button
                key={i}
                onClick={() => { setSelectedDate(i); setSelectedSlot(null); setCalendarDate(null); setPaymentStep(false); }}
                className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] shrink-0 transition-all duration-200 active:scale-95 ${
                  !calendarDate && selectedDate === i
                    ? "bg-primary text-primary-foreground booka-shadow"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <span className="text-[10px] font-medium uppercase">{format(d, "EEE")}</span>
                <span className="text-lg font-bold">{format(d, "d")}</span>
              </button>
            ))}
          </div>
          {calendarDate && (
            <div className="flex items-center gap-2 mt-2 px-1 py-2 rounded-xl bg-primary/10">
              <Calendar size={13} className="text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary flex-1">
                {format(new Date(calendarDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
              </span>
              <button
                onClick={() => { setCalendarDate(null); setSelectedSlot(null); setPaymentStep(false); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}
          <button
            onClick={() => setCalendarOpen(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold transition-all active:scale-[0.98]"
          >
            <ChevronDown size={13} /> More Dates
          </button>
        </div>

        {/* Time slots */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Available Slots</h2>
          {loadingSlots ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl booka-shimmer" />)}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No available slots for this day</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => {
                const isTaken = takenSlotIds.has(slot.id);
                const isSelected = selectedSlot === slot.id;
                const waitCount = getWaitCount(slot);
                return (
                  <button
                    key={slot.id}
                    onClick={() => !isTaken && setSelectedSlot(slot.id)}
                    disabled={isTaken}
                    className={`py-3 px-4 rounded-xl text-sm font-medium flex flex-col items-center gap-0.5 transition-all duration-200 active:scale-[0.97] ${
                      isTaken
                        ? "bg-muted text-muted-foreground cursor-not-allowed line-through opacity-40"
                        : isSelected
                        ? "booka-gradient text-white booka-shadow-blue"
                        : "bg-card border border-border hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isTaken ? <AlertCircle size={13} /> : <Clock size={13} />}
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </span>
                    {!isTaken && waitCount > 0 && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        <Users size={9} /> {waitCount} booking{waitCount > 1 ? "s" : ""} ahead
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="fixed inset-x-0 p-4 bg-card/95 backdrop-blur-md border-t border-border" style={{ bottom: 56, zIndex: 410 }}>
          <div className="max-w-lg mx-auto">
            <Button
              data-testid="button-confirm-booking"
              className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
              onClick={() => setPaymentStep(true)}
            >
              Confirm Reservation — J${commitmentFee.toFixed(0)}
            </Button>
          </div>
        </div>
      )}

      {calendarOpen && (
        <CustomerCalendar
          store={store}
          onSelectDate={(dateStr) => {
            setCalendarDate(dateStr);
            setSelectedSlot(null);
            setPaymentStep(false);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
};

export default CustomerBooking;
