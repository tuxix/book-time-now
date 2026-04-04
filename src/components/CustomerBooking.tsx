import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Star, MapPin, Clock, CheckCircle2, AlertCircle,
  Calendar, ChevronDown, Users, Check, ShoppingBag, ChevronRight, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { type Store } from "@/components/StoreProfile";
import CustomerCalendar from "@/components/CustomerCalendar";
import { DAILY_LIMITS } from "@/lib/categories";
import { getActivePromotion, applyPromotion, type Promotion, type PromoCalc } from "@/lib/promotions";

interface TimeSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  capacity: number;
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
  duration_minutes?: number | null;
  service_option_groups: ServiceOptionGroup[];
}

interface ConfirmedDetails {
  date: string;
  startTime: string;
  endTime: string;
  ref: string;
  serviceName?: string;
  serviceTotal?: number;
  spotNumber?: number;
  totalCapacity?: number;
  promoTitle?: string;
  discountAmount?: number;
  finalPrice?: number;
}

interface StoreHour {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

interface StoreBreak {
  day_of_week: number;
  break_start: string;
  break_end: string;
}

interface Props {
  store: Store & { rescheduleReservationId?: string };
  onBack: () => void;
}

const fmt = (p: number) => `J$${p.toFixed(0)}`;

function generateSlotsFromHours(
  storeHour: StoreHour,
  storeBreaks: StoreBreak[],
  stepMins: number,
  dayOfWeek: number,
): TimeSlot[] {
  if (!storeHour.is_open) return [];
  const toMins = (t: string) => { const [h, m] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
  const toTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const openMins = toMins(storeHour.open_time);
  const closeMins = toMins(storeHour.close_time);
  const breaks = storeBreaks.filter((b) => b.day_of_week === dayOfWeek);
  const slots: TimeSlot[] = [];
  let cur = openMins;
  while (cur + stepMins <= closeMins) {
    const slotEnd = cur + stepMins;
    const overlapsBreak = breaks.some((b) => cur < toMins(b.break_end) && slotEnd > toMins(b.break_start));
    if (!overlapsBreak) {
      slots.push({ id: `gen-${cur}`, day_of_week: dayOfWeek, start_time: toTime(cur), end_time: toTime(slotEnd), is_available: true, capacity: 1 });
    }
    cur += stepMins;
  }
  return slots;
}

const CustomerBooking = ({ store, onBack }: Props) => {
  const { user } = useAuth();
  const rescheduleReservationId = (store as any).rescheduleReservationId as string | undefined;
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [takenSlotIds, setTakenSlotIds] = useState<Set<string>>(new Set());
  const [slotBookingCounts, setSlotBookingCounts] = useState<Record<string, number>>({});
  const [existingBookings, setExistingBookings] = useState<{ start_time: string; end_time: string; service_duration_minutes?: number | null }[]>([]);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [dailyBookingCount, setDailyBookingCount] = useState(0);
  const [useHoursSystem, setUseHoursSystem] = useState(false);
  const [storeHours, setStoreHours] = useState<StoreHour[]>([]);
  const [storeBreaks, setStoreBreaks] = useState<StoreBreak[]>([]);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedDetails | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState(false);

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);

  // Active promotion
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null);
  const [promoTooltip, setPromoTooltip] = useState(false);

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
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  };

  // 12-hour display format (e.g. "9:00 AM", "1:30 PM")
  const fmt12 = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const getWaitCount = (slot: TimeSlot) => {
    const slotStart = timeToMins(slot.start_time);
    return existingBookings.filter((b) => timeToMins(b.start_time) < slotStart).length;
  };

  // Check if customer has accepted platform terms
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("customer_terms_accepted_at")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setTermsAccepted(!!(data as any)?.customer_terms_accepted_at);
      });
  }, [user]);

  // Fetch active promotion for this store
  useEffect(() => {
    const primaryCategory = (store.categories?.[0]) ?? store.category ?? "";
    getActivePromotion(store.id, primaryCategory)
      .then((p) => setActivePromotion(p))
      .catch(() => setActivePromotion(null));
  }, [store.id, store.category]);

  // Auto-show terms gate the moment we confirm they haven't accepted yet
  useEffect(() => {
    if (termsAccepted === false) setShowTermsModal(true);
  }, [termsAccepted]);

  const acceptTermsAndBook = async () => {
    if (!user) return;
    setAcceptingTerms(true);
    await supabase.from("profiles")
      .update({ customer_terms_accepted_at: new Date().toISOString() })
      .eq("id", user.id);
    setTermsAccepted(true);
    setShowTermsModal(false);
    setAcceptingTerms(false);
    // No handleBook() here — user now continues to select a date normally
  };

  // Fetch services and store_hours on mount
  useEffect(() => {
    supabase
      .from("store_services")
      .select("*, service_option_groups(*, service_option_items(*))")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .neq("is_archived", true)
      .order("sort_order")
      .then(({ data }) => { if (data) setServices(data as StoreService[]); });

    Promise.all([
      supabase.from("store_hours").select("*").eq("store_id", store.id),
      supabase.from("store_breaks").select("*").eq("store_id", store.id),
    ]).then(([hoursRes, breaksRes]) => {
      const hours = (hoursRes.data ?? []) as StoreHour[];
      const breaks = (breaksRes.data ?? []) as StoreBreak[];
      if (hours.length > 0) {
        setUseHoursSystem(true);
        setStoreHours(hours);
        setStoreBreaks(breaks);
      }
    });
  }, [store.id]);

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setPaymentStep(false);
    setServiceStep(false);
    setDailyLimitReached(false);

    const isFreeStore = (store.subscription_tier ?? "free") === "free";
    const dailyLimit = isFreeStore ? (DAILY_LIMITS[store.category ?? ""] ?? 0) : 0;

    supabase
      .from("reservations")
      .select("start_time, end_time, service_duration_minutes")
      .eq("store_id", store.id)
      .eq("reservation_date", selectedDateStr)
      .neq("status", "cancelled")
      .then((reservationsRes) => {
        const bookings = (reservationsRes.data ?? []) as { start_time: string; end_time: string; service_duration_minutes?: number | null }[];
        setExistingBookings(bookings);

        const processSlots = (availableSlots: TimeSlot[]) => {
          // Daily limit check (free tier)
          if (isFreeStore && dailyLimit > 0) {
            const dayCount = bookings.length;
            setDailyBookingCount(dayCount);
            if (dayCount >= dailyLimit) {
              setDailyLimitReached(true);
              setTakenSlotIds(new Set(availableSlots.map((s) => s.id)));
              setSlotBookingCounts({});
              setLoadingSlots(false);
              return;
            }
          }
          const buffer = store.buffer_minutes ?? 15;
          const taken = new Set<string>();
          const counts: Record<string, number> = {};
          availableSlots.forEach((slot) => {
            const slotStart = timeToMins(slot.start_time);
            const slotEnd = timeToMins(slot.end_time);
            const cap = slot.capacity ?? 1;
            const exactCount = bookings.filter(
              (b) => b.start_time.slice(0, 5) === slot.start_time.slice(0, 5) &&
                     b.end_time.slice(0, 5) === slot.end_time.slice(0, 5)
            ).length;
            counts[slot.id] = exactCount;
            if (exactCount >= cap) {
              taken.add(slot.id);
            } else {
              for (const b of bookings) {
                const effectiveDuration = b.service_duration_minutes != null
                  ? b.service_duration_minutes
                  : (timeToMins(b.end_time) - timeToMins(b.start_time));
                const bookingEnd = timeToMins(b.start_time) + effectiveDuration + buffer;
                if (slotStart < bookingEnd && slotEnd > timeToMins(b.start_time) &&
                    !(b.start_time.slice(0, 5) === slot.start_time.slice(0, 5) &&
                      b.end_time.slice(0, 5) === slot.end_time.slice(0, 5))) {
                  taken.add(slot.id);
                  break;
                }
              }
            }
          });
          setSlots(availableSlots);
          setSlotBookingCounts(counts);
          setTakenSlotIds(taken);
          setLoadingSlots(false);
        };

        if (useHoursSystem && storeHours.length > 0) {
          const todayHour = storeHours.find((h) => h.day_of_week === dayOfWeek);
          if (todayHour && todayHour.is_open) {
            // Use the minimum service duration as the slot step (respects duration-awareness)
            // Falls back to 60 min if no services have a duration set
            const durations = services
              .map((s) => s.duration_minutes)
              .filter((d): d is number => typeof d === "number" && d >= 15);
            const stepMins = durations.length > 0 ? Math.min(...durations) : 60;
            const generated = generateSlotsFromHours(todayHour, storeBreaks, stepMins, dayOfWeek);
            processSlots(generated);
          } else {
            setSlots([]);
            setLoadingSlots(false);
          }
        } else {
          supabase
            .from("store_time_slots")
            .select("*")
            .eq("store_id", store.id)
            .eq("day_of_week", dayOfWeek)
            .eq("is_available", true)
            .order("start_time", { ascending: true })
            .then((slotsRes) => {
              const availableSlots = ((slotsRes.data ?? []) as TimeSlot[])
                .sort((a, b) => a.start_time.slice(0, 5).localeCompare(b.start_time.slice(0, 5)));
              processSlots(availableSlots);
            });
        }
      });
  }, [store.id, store.buffer_minutes, dayOfWeek, selectedDateStr, calendarDate, useHoursSystem, storeHours, storeBreaks, services]);

  // ── Service computed values ──────────────────────────────────────────────
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  // ── End-of-day slot filter ───────────────────────────────────────────────
  // When a service is selected, hide slots where start + duration + buffer exceeds closing time
  const todayHour = storeHours.find((h) => h.day_of_week === dayOfWeek);
  const closingMins = todayHour?.is_open && todayHour?.close_time ? timeToMins(todayHour.close_time) : null;
  const bufferMins = store.buffer_minutes ?? 15;
  const svcDuration = selectedService?.duration_minutes ?? null;
  const displaySlots = (useHoursSystem && closingMins !== null && svcDuration !== null)
    ? slots.filter((slot) => timeToMins(slot.start_time) + svcDuration + bufferMins <= closingMins)
    : slots;

  const serviceTotal = selectedService
    ? selectedService.base_price +
      selectedService.service_option_groups.flatMap((g) =>
        (selectedItems[g.id] ?? []).map((itemId) => {
          const item = g.service_option_items.find((i) => i.id === itemId);
          return item?.price_modifier ?? 0;
        })
      ).reduce((a, b) => a + b, 0)
    : 0;

  // Derived promo calculation — must be after serviceTotal
  const promoCalc: PromoCalc | null =
    activePromotion && serviceTotal > 0
      ? applyPromotion(serviceTotal, activePromotion)
      : null;

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

  const handleBook = async () => {
    const slot = slots.find((s) => s.id === selectedSlot);
    if (!slot || !user) return;
    setBooking(true);
    try {
      // ── RESCHEDULE MODE ────────────────────────────────────────────────────
      if (rescheduleReservationId) {
        const { data: oldRes } = await supabase
          .from("reservations")
          .select("reservation_date, start_time, reschedule_count, original_date, original_start_time")
          .eq("id", rescheduleReservationId)
          .single();
        const origDate = (oldRes as any)?.original_date ?? (oldRes as any)?.reservation_date;
        const origStart = (oldRes as any)?.original_start_time ?? (oldRes as any)?.start_time;
        const { error } = await supabase.from("reservations").update({
          reservation_date: selectedDateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: "scheduled",
          reschedule_count: ((oldRes as any)?.reschedule_count ?? 0) + 1,
          original_date: origDate,
          original_start_time: origStart,
        }).eq("id", rescheduleReservationId);
        if (error) throw error;
        toast.success("Appointment rescheduled successfully!");
        onBack();
        return;
      }

      const { count: existingCount } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("reservation_date", selectedDateStr)
        .eq("start_time", slot.start_time)
        .eq("end_time", slot.end_time)
        .neq("status", "cancelled");

      const cap = slot.capacity ?? 1;
      if ((existingCount ?? 0) >= cap) {
        toast.error("That slot is now full. Please choose another time.");
        setSlotBookingCounts((prev) => ({ ...prev, [slot.id]: cap }));
        setTakenSlotIds((prev) => new Set([...prev, slot.id]));
        setSelectedSlot(null);
        setPaymentStep(false);
        setServiceStep(false);
        return;
      }
      const spotNumber = (existingCount ?? 0) + 1;

      // ── Daily booking limit check for free-tier stores ──────────────────────
      if ((store.subscription_tier ?? "free") === "free") {
        const primaryCategory = (store.categories?.[0]) ?? store.category;
        const dailyLimit = DAILY_LIMITS[primaryCategory] ?? 5;
        const { count: dailyCount } = await supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id)
          .eq("reservation_date", selectedDateStr)
          .neq("status", "cancelled");
        if ((dailyCount ?? 0) >= dailyLimit) {
          toast.error(`${store.name} is fully booked for that day. Try a different date.`);
          setBooking(false);
          return;
        }
      }

      const bookingTotal = serviceTotal || 0;

      // ── Promotion-aware price calculation ──────────────────────────────────
      // Store earnings are ALWAYS based on original total (promoCalc guarantees this)
      const calc = bookingTotal > 0 && activePromotion
        ? applyPromotion(bookingTotal, activePromotion)
        : null;

      const commissionAmount = Math.round(bookingTotal * 0.10);
      const storeEarnings = bookingTotal - commissionAmount;
      const discountAmount = calc?.discountAmount ?? 0;
      const finalPrice = calc?.finalPrice ?? bookingTotal;

      const { data: inserted, error } = await supabase
        .from("reservations")
        .insert({
          customer_id: user.id,
          store_id: store.id,
          reservation_date: selectedDateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
          total_amount: bookingTotal,
          service_total: selectedService ? serviceTotal : null,
          payment_status: "pending",
          service_duration_minutes: selectedService?.duration_minutes ?? null,
          commission_amount: bookingTotal > 0 ? commissionAmount : null,
          store_earnings: bookingTotal > 0 ? storeEarnings : null,
          payout_status: "unpaid",
          // Promotion fields
          discount_amount: discountAmount,
          final_price: finalPrice,
          promotion_id: activePromotion?.id ?? null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // ── Post-insert race condition check ────────────────────────────────────
      // Re-count the slot immediately after insert to catch concurrent bookings
      if (inserted?.id) {
        const { count: postCount } = await supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id)
          .eq("reservation_date", selectedDateStr)
          .eq("start_time", slot.start_time)
          .eq("end_time", slot.end_time)
          .neq("status", "cancelled");
        if ((postCount ?? 0) > cap) {
          // Another booking sneaked in simultaneously — roll back ours
          await supabase.from("reservations").delete().eq("id", inserted.id);
          toast.error("That slot just filled up. Please choose another time.");
          setTakenSlotIds((prev) => new Set([...prev, slot.id]));
          setSelectedSlot(null);
          setPaymentStep(false);
          setServiceStep(false);
          setBooking(false);
          return;
        }
      }

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

      /* ── FYGARO PAYMENT REDIRECT (future integration hook) ──────────────────
         When Fygaro is active, call initiatePayment(inserted.id) here.
         See src/lib/payments.ts for the scaffold.
      ── END FYGARO HOOK ──────────────────────────────────────────────────── */

      // Show confirmation immediately (payment_status = 'pending', pay at appointment)
      setConfirmed({
        date: format(activeDateObj, "MMMM d, yyyy"),
        startTime: slot.start_time.slice(0, 5),
        endTime: slot.end_time.slice(0, 5),
        ref: (inserted?.id as string)?.split("-")[0]?.toUpperCase() ?? "—",
        serviceName: selectedService?.name,
        serviceTotal: selectedService ? serviceTotal : undefined,
        spotNumber,
        totalCapacity: slot.capacity ?? 1,
        promoTitle: calc ? activePromotion?.title : undefined,
        discountAmount: calc?.discountAmount,
        finalPrice: calc?.finalPrice,
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
            {confirmed.serviceTotal != null && confirmed.serviceTotal > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Price</p>
                {confirmed.promoTitle && confirmed.discountAmount != null && confirmed.finalPrice != null ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground line-through">Original {fmt(confirmed.serviceTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-green-600">Rezo Promo discount</span>
                      <span className="text-xs font-bold text-green-600">−{fmt(confirmed.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-border">
                      <span className="text-sm font-bold text-foreground">You pay</span>
                      <span className="text-xl font-extrabold text-primary">{fmt(confirmed.finalPrice)}</span>
                    </div>
                    <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2">
                      <p className="text-[11px] text-green-700 dark:text-green-300 font-medium">🎉 {confirmed.promoTitle} — saved {fmt(confirmed.discountAmount)}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">Rezo funded this discount. The store receives their full earnings.</p>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center pt-1 border-t border-border">
                    <span className="text-xs font-bold text-foreground">Service total</span>
                    <span className="text-xl font-extrabold text-primary">{fmt(confirmed.serviceTotal)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">💳 Payment due at your appointment</span>
                </div>
              </div>
            )}
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
              {confirmed.spotNumber != null && confirmed.totalCapacity != null && confirmed.totalCapacity > 1 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Users size={11} /> Spot {confirmed.spotNumber} of {confirmed.totalCapacity}
                </p>
              )}
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
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-xs text-primary font-semibold">
                            {svc.base_price > 0 ? `From ${fmt(svc.base_price)}` : "Price by selection"}
                          </p>
                          {svc.duration_minutes && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Clock size={10} />~{svc.duration_minutes} min
                            </span>
                          )}
                        </div>
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
            Continue without selecting a service
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
                : `Review Booking — ${fmt(serviceTotal)}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review & Confirm step ────────────────────────────────────────────────
  if (paymentStep && selectedSlotObj) {
    return (
      <div className="absolute inset-x-0 top-0 bg-background overflow-y-auto" style={{ bottom: 56, zIndex: 410 }}>
        <div className="flex flex-col items-center justify-start px-6 pt-8 pb-32">
          <div className="w-full max-w-xs space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Calendar size={30} className="text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground">Review Your Booking</h1>
              <p className="text-sm text-muted-foreground mt-1">Almost done — confirm your spot</p>
            </div>

            <div className="p-5 rounded-2xl bg-card booka-shadow text-left space-y-3 w-full">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Store</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{store.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {format(activeDateObj, "MMMM d, yyyy")} · {fmt12(selectedSlotObj.start_time)} – {fmt12(selectedSlotObj.end_time)}
                </p>
              </div>

              {selectedService && (
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Price Breakdown</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{selectedService.name}</span>
                    <span className="text-sm font-semibold text-foreground">{fmt(selectedService.base_price)}</span>
                  </div>
                  {selectedService.service_option_groups.map((g) => {
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
                  {promoCalc ? (
                    <>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm text-muted-foreground">Original price</span>
                        <span className="text-sm text-muted-foreground line-through">{fmt(serviceTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                          {activePromotion!.discount_type === "percentage"
                            ? `${activePromotion!.discount_value}% OFF`
                            : `J$${activePromotion!.discount_value} OFF`} — Rezo Promo
                          <button
                            onClick={() => setPromoTooltip(!promoTooltip)}
                            className="text-green-500 hover:text-green-700 transition-colors"
                          >
                            <Info size={13} />
                          </button>
                        </span>
                        <span className="text-sm font-bold text-green-600">−{fmt(promoCalc.discountAmount)}</span>
                      </div>
                      {promoTooltip && (
                        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-[11px] text-green-700 dark:text-green-300">
                          Rezo is funding this discount. The store receives their full earnings.
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-sm font-bold text-foreground">You pay</span>
                        <span className="text-2xl font-extrabold text-primary">{fmt(promoCalc.finalPrice)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm font-bold text-foreground">Total</span>
                      <span className="text-2xl font-extrabold text-primary">{fmt(serviceTotal)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                💳 <strong>No payment required now.</strong> Your booking is confirmed instantly. Pay at your appointment.
              </p>
            </div>

            <Button
              data-testid="button-confirm-booking"
              className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
              onClick={() => { if (termsAccepted === false) setShowTermsModal(true); else handleBook(); }}
              disabled={booking}
            >
              {booking ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Confirming…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />
                  Confirm Booking
                </span>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Your spot is held — no charge until you arrive
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

        {/* Reschedule banner */}
        {rescheduleReservationId && (
          <div className="px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-xs leading-relaxed">
            <span className="font-bold block mb-0.5">🔄 Rescheduling Appointment</span>
            Select a new date and time below. Your booking will be updated at no extra cost.
          </div>
        )}

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
          {dailyLimitReached && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 mb-3">
              <AlertCircle size={14} className="text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                This store is fully booked for {selectedDateStr === format(new Date(), "yyyy-MM-dd") ? "today" : format(new Date(selectedDateStr + "T00:00:00"), "MMM d")}
              </p>
            </div>
          )}
          {!dailyLimitReached && (() => {
            const isFreeStore = (store.subscription_tier ?? "free") === "free";
            const dailyLimit = isFreeStore ? (DAILY_LIMITS[store.category ?? ""] ?? 0) : 0;
            if (!isFreeStore || dailyLimit === 0 || dailyBookingCount < Math.ceil(dailyLimit * 0.8)) return null;
            return (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 mb-3">
                <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  Almost full — booking up fast for {selectedDateStr === format(new Date(), "yyyy-MM-dd") ? "today" : format(new Date(selectedDateStr + "T00:00:00"), "MMM d")}!
                </p>
              </div>
            );
          })()}
          {loadingSlots ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl booka-shimmer" />)}
            </div>
          ) : displaySlots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No available slots for this day</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {displaySlots.map((slot) => {
                const isTaken = takenSlotIds.has(slot.id);
                const isSelected = selectedSlot === slot.id;
                const cap = slot.capacity ?? 1;
                const bookingCount = slotBookingCounts[slot.id] ?? 0;
                const remaining = cap - bookingCount;
                const isLastSpot = !isTaken && remaining === 1 && cap > 1;
                const hasMultipleSpots = !isTaken && cap > 1 && remaining > 1;
                return (
                  <button
                    key={slot.id}
                    onClick={() => !isTaken && setSelectedSlot(slot.id)}
                    disabled={isTaken}
                    className={`py-3 px-4 rounded-xl text-sm font-medium flex flex-col items-center gap-0.5 transition-all duration-200 active:scale-[0.97] ${
                      isTaken
                        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
                        : isSelected
                        ? "booka-gradient text-white booka-shadow-blue"
                        : isLastSpot
                        ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-400 text-foreground"
                        : "bg-card border border-border hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isTaken ? <AlertCircle size={13} /> : <Clock size={13} />}
                      {fmt12(slot.start_time)} – {fmt12(slot.end_time)}
                    </span>
                    {isTaken && (
                      <span className="text-[10px]">Full</span>
                    )}
                    {!isTaken && isLastSpot && (
                      <span className={`text-[10px] font-semibold ${isSelected ? "text-primary-foreground/90" : "text-amber-600 dark:text-amber-400"}`}>
                        Last spot!
                      </span>
                    )}
                    {!isTaken && hasMultipleSpots && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        <Users size={9} /> {remaining} spots left
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
                className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0 flex items-center justify-center gap-2"
                onClick={() => setPaymentStep(true)}
              >
                <CheckCircle2 size={16} /> Review & Confirm
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

      {/* ── Terms of Service Gate ──────────────────────────────────────────── */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[600] flex flex-col bg-background">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <button
              onClick={() => {
                // If user hasn't started booking yet (gate mode), exit fully
                if (!selectedSlot && !paymentStep) { onBack(); }
                else { setShowTermsModal(false); }
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-bold text-base text-foreground">Rezo Platform Terms</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-foreground/80 leading-relaxed">
            <p className="font-bold text-foreground text-base">Before booking, please read and accept the Rezo User Terms.</p>

            <div className="space-y-3">
              <h3 className="font-bold text-foreground">1. Booking Responsibility</h3>
              <p>When you book through Rezo, you agree to attend your appointment at the scheduled date and time, or cancel at least 24 hours in advance. Repeated no-shows may result in account suspension.</p>

              <h3 className="font-bold text-foreground">2. Pay at Appointment</h3>
              <p>Payment for services is made directly to the store at the time of your appointment. Rezo does not process advance payments — you will never be charged a fee to book.</p>

              <h3 className="font-bold text-foreground">3. Keep it on Rezo</h3>
              <p>For your protection, all communication must remain within the Rezo platform. Never share your personal phone number, WhatsApp, or social media handle with stores via the chat. Violations may result in account action.</p>

              <h3 className="font-bold text-foreground">4. Respect</h3>
              <p>You agree to treat all service providers with respect. Abusive behaviour, threats, or harassment will result in permanent account suspension.</p>

              <h3 className="font-bold text-foreground">5. Disputes</h3>
              <p>If you have a problem with a service you received, you may file a dispute through Rezo. We will review all disputes fairly within 5 business days.</p>

              <h3 className="font-bold text-foreground">6. Data & Privacy</h3>
              <p>Rezo collects your name, phone number, and booking history to provide the service. We do not sell your data to third parties. Your data is stored securely in accordance with Jamaican data protection law.</p>

              <h3 className="font-bold text-foreground">7. Platform Changes</h3>
              <p>Rezo reserves the right to modify these terms at any time. Continued use of the platform constitutes acceptance of any updated terms.</p>
            </div>

            <p className="text-xs text-muted-foreground pt-2">By tapping "Accept & Continue" you confirm you have read and agree to these terms. Rezo is a contractor marketplace — stores are independent businesses, not Rezo employees.</p>
          </div>
          <div className="shrink-0 p-4 border-t border-border">
            <Button
              data-testid="button-accept-terms"
              className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
              onClick={acceptTermsAndBook}
              disabled={acceptingTerms}
            >
              {acceptingTerms ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} /> Accept & Continue
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerBooking;
