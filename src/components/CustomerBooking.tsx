import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Star, MapPin, Clock, CheckCircle2, AlertCircle,
  Calendar, ChevronDown, CreditCard, Users, Check, ShoppingBag, ChevronRight,
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

interface ServiceOptionItem {
  id: string;
  group_id: string;
  label: string;
  price_modifier: number;
  sort_order: number;
}

interface ServiceOptionGroup {
  id: string;
  service_id: string;
  label: string;
  selection_type: "single" | "multi";
  required: boolean;
  sort_order: number;
  service_option_items: ServiceOptionItem[];
}

interface StoreService {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  sort_order: number;
  is_active: boolean;
  service_option_groups: ServiceOptionGroup[];
}

interface ConfirmedDetails {
  date: string;
  startTime: string;
  endTime: string;
  ref: string;
  serviceName?: string;
  serviceTotal?: number;
}

interface Props {
  store: Store;
  onBack: () => void;
}

const fmt = (p: number) => `J$${p.toFixed(0)}`;

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

  // Service customizer state
  const [services, setServices] = useState<StoreService[]>([]);
  const [serviceStep, setServiceStep] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});

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

  // Fetch services on mount
  useEffect(() => {
    supabase
      .from("store_services")
      .select("*, service_option_groups(*, service_option_items(*))")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => { if (data) setServices(data as StoreService[]); });
  }, [store.id]);

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setPaymentStep(false);
    setServiceStep(false);

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

  // ── Service computed values ──────────────────────────────────────────────
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  const serviceTotal = selectedService
    ? selectedService.base_price +
      selectedService.service_option_groups.flatMap((g) =>
        (selectedItems[g.id] ?? []).map((itemId) => {
          const item = g.service_option_items.find((i) => i.id === itemId);
          return item?.price_modifier ?? 0;
        })
      ).reduce((a, b) => a + b, 0)
    : 0;

  const requiredGroupsFilled = selectedService
    ? selectedService.service_option_groups
        .filter((g) => g.required)
        .every((g) => (selectedItems[g.id] ?? []).length > 0)
    : true;

  const hasServices = services.length > 0;

  const toggleItem = (group: ServiceOptionGroup, itemId: string) => {
    setSelectedItems((prev) => {
      const current = prev[group.id] ?? [];
      if (group.selection_type === "single") {
        return { ...prev, [group.id]: [itemId] };
      }
      const already = current.includes(itemId);
      return { ...prev, [group.id]: already ? current.filter((i) => i !== itemId) : [...current, itemId] };
    });
  };

  const commitmentFee = store.commitment_fee ?? 750;

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
        setServiceStep(false);
        return;
      }

      const totalCharged = selectedService ? serviceTotal : commitmentFee;
      const { data: inserted, error } = await supabase
        .from("reservations")
        .insert({
          customer_id: user.id,
          store_id: store.id,
          reservation_date: selectedDateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
          total_amount: totalCharged,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (selectedService && inserted?.id) {
        const allSelectedIds = Object.values(selectedItems).flat();
        // Keep existing selection record
        await supabase.from("reservation_service_selections").insert({
          reservation_id: inserted.id,
          service_id: selectedService.id,
          selected_item_ids: allSelectedIds,
          total_price: serviceTotal,
        });
        // Build rich options list for receipts/history
        const selectedOptions: { group_label: string; item_label: string; price_modifier: number }[] = [];
        let optionsTotal = 0;
        for (const group of selectedService.service_option_groups) {
          const pickedIds = selectedItems[group.id] ?? [];
          for (const itemId of pickedIds) {
            const item = group.service_option_items.find((i) => i.id === itemId);
            if (item) {
              selectedOptions.push({ group_label: group.label, item_label: item.label, price_modifier: item.price_modifier });
              optionsTotal += item.price_modifier;
            }
          }
        }
        await supabase.from("reservation_services").insert({
          reservation_id: inserted.id,
          service_id: selectedService.id,
          service_name: selectedService.name,
          base_price: selectedService.base_price,
          selected_options: selectedOptions,
          options_total: optionsTotal,
          subtotal: selectedService.base_price + optionsTotal,
        });
      }

      setPaymentStep(false);
      setServiceStep(false);

      // ── PLACEHOLDER: mark payment as paid immediately (Fygaro not yet active) ─
      if (commitmentFee > 0 && inserted?.id) {
        await supabase
          .from("reservations")
          .update({ payment_status: "paid" })
          .eq("id", inserted.id as string);
      }

      /* ── FYGARO REDIRECT (uncomment when Fygaro account is active) ──────────
      if (commitmentFee > 0 && inserted?.id) {
        const reservationId = inserted.id as string;
        const confirmedDetails = {
          reservationId,
          date: format(activeDateObj, "MMMM d, yyyy"),
          startTime: slot.start_time.slice(0, 5),
          endTime: slot.end_time.slice(0, 5),
          ref: reservationId.split("-")[0].toUpperCase(),
          storeName: store.name,
          serviceName: selectedService?.name,
          serviceTotal: selectedService ? serviceTotal : undefined,
        };
        try {
          localStorage.setItem("booka_pending_payment", JSON.stringify(confirmedDetails));
        } catch {}

        const buttonId = import.meta.env.VITE_FYGARO_BUTTON_ID ?? "";
        const note = encodeURIComponent(`Booking at ${store.name}`);
        const amount = commitmentFee.toFixed(2);
        const fygaroUrl =
          `https://www.fygaro.com/en/pb/${buttonId}` +
          `?amount=${amount}&client_note=${note}&client_reference=${reservationId}`;
        window.location.href = fygaroUrl;
        return;
      }
      ── END FYGARO REDIRECT ──────────────────────────────────────────────── */

      // Show confirmation immediately (placeholder + no-fee path)
      setConfirmed({
        date: format(activeDateObj, "MMMM d, yyyy"),
        startTime: slot.start_time.slice(0, 5),
        endTime: slot.end_time.slice(0, 5),
        ref: (inserted?.id as string)?.split("-")[0]?.toUpperCase() ?? "—",
        serviceName: selectedService?.name,
        serviceTotal: selectedService ? serviceTotal : undefined,
      });
    } catch (err: any) {
      toast.error(err.message || "Booking failed. Please try again.");
      setPaymentStep(false);
    } finally {
      setBooking(false);
    }
  };

  const selectedSlotObj = slots.find((s) => s.id === selectedSlot);

  // ── Confirmed screen ─────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background flex flex-col items-center justify-center px-6 fade-in" style={{ bottom: 56, zIndex: 400 }}>
        <div className="w-full max-w-xs text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto bounce-in">
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
            {confirmed.serviceName && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Service</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{confirmed.serviceName}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Charged</p>
              <p className="text-xl font-extrabold text-primary mt-0.5">
                {fmt(confirmed.serviceTotal ?? commitmentFee)}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                Includes {fmt(commitmentFee)} commitment deposit
              </p>
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
          <Button className="w-full rounded-xl h-12 font-semibold booka-gradient booka-shadow-blue text-white border-0" onClick={onBack}>Done</Button>
        </div>
      </div>
    );
  }

  // ── Service customizer step ──────────────────────────────────────────────
  if (serviceStep && !paymentStep) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background overflow-y-auto" style={{ bottom: 56, zIndex: 410, paddingBottom: 96 }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setServiceStep(false)} className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-sm">Choose Your Service</h1>
            <p className="text-xs text-muted-foreground">{store.name}</p>
          </div>
        </div>

        <div className="px-5 pt-4 space-y-5">
          {/* Service picker */}
          <div>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Select a Service</h2>
            <div className="space-y-2">
              {services.map((svc) => {
                const isSelected = selectedServiceId === svc.id;
                return (
                  <button
                    key={svc.id}
                    onClick={() => {
                      setSelectedServiceId(svc.id);
                      setSelectedItems({});
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-primary bg-primary/5 booka-shadow-blue"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">{svc.name}</p>
                        {svc.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{svc.description}</p>
                        )}
                        <p className="text-xs text-primary font-semibold mt-1">
                          {svc.base_price > 0 ? `From ${fmt(svc.base_price)}` : "Price by selection"}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 transition-all ${
                        isSelected ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Option groups for selected service */}
          {selectedService && selectedService.service_option_groups.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Customize Your {selectedService.name}</h2>
              {[...selectedService.service_option_groups]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((group) => {
                  const pickedIds = selectedItems[group.id] ?? [];
                  const isFilled = pickedIds.length > 0;
                  return (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground flex-1">{group.label}</p>
                        {group.required ? (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isFilled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {isFilled ? "✓ Done" : "Required"}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">Optional</span>
                        )}
                        {group.selection_type === "multi" && (
                          <span className="text-[9px] text-muted-foreground">pick any</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[...group.service_option_items]
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((item) => {
                            const isChosen = pickedIds.includes(item.id);
                            return (
                              <button
                                key={item.id}
                                onClick={() => toggleItem(group, item.id)}
                                className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all active:scale-95 ${
                                  isChosen
                                    ? "booka-gradient text-white border-transparent booka-shadow-blue"
                                    : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 text-foreground"
                                }`}
                              >
                                <span>{item.label}</span>
                                {item.price_modifier !== 0 && (
                                  <span className={`ml-1.5 text-xs font-bold ${isChosen ? "text-white/80" : "text-primary"}`}>
                                    {item.price_modifier > 0 ? `+${fmt(item.price_modifier)}` : fmt(item.price_modifier)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Skip option */}
          <button
            onClick={() => { setSelectedServiceId(null); setSelectedItems({}); setServiceStep(false); setPaymentStep(true); }}
            className="w-full py-3 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Skip service selection → proceed with commitment fee only
          </button>
        </div>

        {/* Sticky bottom: price + CTA */}
        <div className="fixed inset-x-0 bg-card/95 backdrop-blur-md border-t border-border p-4" style={{ bottom: 56, zIndex: 420 }}>
          <div className="max-w-lg mx-auto">
            {selectedService && (
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-muted-foreground">{selectedService.name}</span>
                <span className="text-lg font-extrabold text-primary">{fmt(serviceTotal)}</span>
              </div>
            )}
            <Button
              className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
              onClick={() => { if (selectedService) setPaymentStep(true); }}
              disabled={!selectedServiceId || !requiredGroupsFilled}
            >
              {!selectedServiceId
                ? "Select a service above"
                : !requiredGroupsFilled
                ? "Complete required selections"
                : `Review & Pay — ${fmt(serviceTotal)}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment confirmation step ────────────────────────────────────────────
  if (paymentStep && selectedSlotObj) {
    const showService = !!selectedService;
    return (
      <div className="absolute inset-x-0 top-0 bg-background overflow-y-auto" style={{ bottom: 56, zIndex: 410 }}>
        <div className="flex flex-col items-center justify-start px-6 pt-8 pb-32">
          <div className="w-full max-w-xs space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CreditCard size={30} className="text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground">Confirm Your Booking</h1>
              <p className="text-sm text-muted-foreground mt-1">Review everything below</p>
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

              {showService ? (
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Service Summary</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{selectedService!.name}</span>
                    <span className="text-sm font-semibold text-foreground">{fmt(selectedService!.base_price)}</span>
                  </div>
                  {selectedService!.service_option_groups.map((g) => {
                    const pickedIds = selectedItems[g.id] ?? [];
                    return pickedIds.map((itemId) => {
                      const item = g.service_option_items.find((i) => i.id === itemId);
                      if (!item) return null;
                      return (
                        <div key={itemId} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Check size={10} className="text-primary" /> {item.label}
                          </span>
                          <span className="text-muted-foreground">
                            {item.price_modifier > 0 ? `+${fmt(item.price_modifier)}` : item.price_modifier === 0 ? "—" : fmt(item.price_modifier)}
                          </span>
                        </div>
                      );
                    });
                  })}
                  <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{fmt(serviceTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                    <span>Commitment deposit (held until appointment)</span>
                    <span>{fmt(commitmentFee)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm font-bold text-foreground">Total charged today</span>
                    <span className="text-2xl font-extrabold text-primary">{fmt(serviceTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total charged today</p>
                  <p className="text-2xl font-extrabold text-primary mt-0.5">{fmt(commitmentFee)}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Commitment deposit — held until your appointment</p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-1">
              Your {fmt(commitmentFee)} deposit is released to the store on completion. If you do not show up, the deposit is retained by the store and the remainder is refunded.
            </p>

            <Button
              data-testid="button-confirm-pay"
              className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
              onClick={handleBook}
              disabled={booking}
            >
              {booking ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CreditCard size={16} />
                  Pay {fmt(selectedService ? serviceTotal : commitmentFee)} · Confirm Booking
                </span>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              🔒 Secure payment coming soon
            </p>
            <button
              onClick={() => { setPaymentStep(false); if (hasServices && selectedServiceId) setServiceStep(true); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main booking screen ──────────────────────────────────────────────────
  return (
    <div className="absolute inset-x-0 top-0 bg-background overflow-y-auto slide-in-right" style={{ bottom: 56, zIndex: 400, paddingBottom: 96 }}>
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

        {/* Announcement banner */}
        {store.announcement && (
          <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
            <span className="font-bold block mb-0.5">📢 Announcement</span>
            {store.announcement}
          </div>
        )}

        {/* Date picker */}
        <div>
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Select a Date</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {dates.map((d, i) => (
              <button
                key={i}
                onClick={() => { setSelectedDate(i); setSelectedSlot(null); setCalendarDate(null); setPaymentStep(false); setServiceStep(false); }}
                className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] shrink-0 transition-all duration-200 active:scale-95 ${
                  !calendarDate && selectedDate === i
                    ? "booka-gradient text-white booka-shadow-blue"
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
                onClick={() => { setCalendarDate(null); setSelectedSlot(null); setPaymentStep(false); setServiceStep(false); }}
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
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Choose a Time</h2>
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

      {/* Fixed CTA */}
      {selectedSlot && (
        <div className="fixed inset-x-0 p-4 bg-card/95 backdrop-blur-md border-t border-border" style={{ bottom: 56, zIndex: 410 }}>
          <div className="max-w-lg mx-auto">
            {hasServices ? (
              <Button
                data-testid="button-choose-services"
                className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0 flex items-center justify-center gap-2"
                onClick={() => setServiceStep(true)}
              >
                <ShoppingBag size={16} /> Choose Services <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                data-testid="button-confirm-booking"
                className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
                onClick={() => setPaymentStep(true)}
              >
                Confirm Reservation — {fmt(commitmentFee)}
              </Button>
            )}
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
            setServiceStep(false);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
};

export default CustomerBooking;
