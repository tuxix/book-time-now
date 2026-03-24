import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, addMonths, startOfMonth, getDaysInMonth } from "date-fns";
import { getJamaicanHolidays } from "@/lib/holidays";
import { type Store } from "@/components/StoreProfile";

interface Props {
  store: Store;
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function calendarCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const pad = first.getDay();
  const total = getDaysInMonth(first);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
  return cells;
}

const CustomerCalendar = ({ store, onSelectDate, onClose }: Props) => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const minMonth = startOfMonth(today);
  const maxMonth = startOfMonth(addMonths(today, 1));

  const [viewDate, setViewDate] = useState(() => minMonth);
  const [closedSet, setClosedSet] = useState<Set<string>>(new Set());
  const [slotDows, setSlotDows] = useState<Set<number>>(new Set());
  const [slotCountByDow, setSlotCountByDow] = useState<Map<number, number>>(new Map());
  const [bookedByDate, setBookedByDate] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(viewDate);
  const monthStr = format(viewDate, "yyyy-MM");
  const holidays = getJamaicanHolidays(year);

  const canGoPrev = viewDate > minMonth;
  const canGoNext = viewDate < maxMonth;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const endStr = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

    const [slotsRes, closedRes, reservRes] = await Promise.all([
      supabase
        .from("store_time_slots")
        .select("day_of_week, id")
        .eq("store_id", store.id)
        .eq("is_available", true),
      supabase
        .from("store_closed_dates")
        .select("closed_date, reason")
        .eq("store_id", store.id)
        .gte("closed_date", `${monthStr}-01`)
        .lte("closed_date", endStr),
      supabase
        .from("reservations")
        .select("reservation_date")
        .eq("store_id", store.id)
        .gte("reservation_date", `${monthStr}-01`)
        .lte("reservation_date", endStr)
        .neq("status", "cancelled"),
    ]);

    const dowCounts = new Map<number, number>();
    const dowSet = new Set<number>();
    if (slotsRes.data) {
      for (const s of slotsRes.data) {
        dowSet.add(s.day_of_week);
        dowCounts.set(s.day_of_week, (dowCounts.get(s.day_of_week) || 0) + 1);
      }
    }
    setSlotDows(dowSet);
    setSlotCountByDow(dowCounts);

    const openOverrides = new Set(
      (closedRes.data || []).filter((c) => c.reason === "Open").map((c) => c.closed_date)
    );
    const closed = new Set<string>();
    if (closedRes.data) {
      for (const c of closedRes.data) {
        if (c.reason !== "Open") closed.add(c.closed_date);
      }
    }
    holidays.forEach((_, dateStr) => {
      if (!openOverrides.has(dateStr) && dateStr.startsWith(monthStr)) {
        closed.add(dateStr);
      }
    });
    setClosedSet(closed);

    const counts = new Map<string, number>();
    if (reservRes.data) {
      for (const r of reservRes.data) {
        counts.set(r.reservation_date, (counts.get(r.reservation_date) || 0) + 1);
      }
    }
    setBookedByDate(counts);
    setLoading(false);
  }, [store.id, monthStr, daysInMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  type CellStatus = "past" | "closed" | "no-slots" | "full" | "available";
  const getStatus = (d: Date): CellStatus => {
    const dateStr = format(d, "yyyy-MM-dd");
    if (dateStr < todayStr) return "past";
    if (closedSet.has(dateStr)) return "closed";
    const dow = d.getDay();
    if (!slotDows.has(dow)) return "no-slots";
    const total = slotCountByDow.get(dow) || 0;
    const booked = bookedByDate.get(dateStr) || 0;
    if (total > 0 && booked >= total) return "full";
    return "available";
  };

  const cells = calendarCells(year, month);

  return (
    <div className="fixed inset-0 z-[500] bg-background flex flex-col">
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all"
        >
          <X size={20} />
        </button>
        <span className="font-bold text-foreground flex-1">Choose a Date</span>
        <div className="flex items-center gap-0.5">
          <button
            disabled={!canGoPrev}
            onClick={() => canGoPrev && setViewDate((d) => startOfMonth(addMonths(d, -1)))}
            className="p-1.5 rounded-lg hover:bg-secondary active:scale-95 transition-all disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold w-28 text-center">{format(viewDate, "MMM yyyy")}</span>
          <button
            disabled={!canGoNext}
            onClick={() => canGoNext && setViewDate((d) => startOfMonth(addMonths(d, 1)))}
            className="p-1.5 rounded-lg hover:bg-secondary active:scale-95 transition-all disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <div className="grid grid-cols-7 mb-2">
          {DOW.map((d) => (
            <div key={d} className="text-center text-[11px] font-bold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-11 rounded-xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dateStr = format(d, "yyyy-MM-dd");
              const status = getStatus(d);
              const isToday = dateStr === todayStr;
              const tappable = status === "available";

              let cellCls = "relative flex flex-col items-center justify-center rounded-xl min-h-[44px] transition-all ";
              let numCls = "text-sm font-semibold ";
              let sublabel: string | null = null;

              if (status === "available") {
                cellCls += "bg-green-500 dark:bg-green-600 active:scale-95 cursor-pointer";
                numCls += "text-white";
              } else if (status === "full") {
                cellCls += "bg-slate-200 dark:bg-slate-700 cursor-not-allowed";
                numCls += "text-slate-500 dark:text-slate-400";
                sublabel = "FULL";
              } else if (status === "closed") {
                cellCls += "bg-red-100 dark:bg-red-900/30 cursor-not-allowed";
                numCls += "text-red-400";
                sublabel = "CLOSED";
              } else if (status === "no-slots") {
                cellCls += "bg-secondary cursor-not-allowed opacity-40";
                numCls += "text-muted-foreground";
              } else {
                cellCls += "opacity-25 cursor-not-allowed";
                numCls += "text-muted-foreground";
              }

              if (isToday && status === "available") {
                cellCls += " ring-2 ring-white ring-offset-2 ring-offset-green-500";
              } else if (isToday) {
                cellCls += " ring-2 ring-primary ring-offset-1";
              }

              return (
                <button
                  key={dateStr}
                  data-testid={`calendar-pick-${dateStr}`}
                  disabled={!tappable}
                  onClick={() => tappable && onSelectDate(dateStr)}
                  className={cellCls}
                >
                  <span className={numCls}>{d.getDate()}</span>
                  {sublabel && (
                    <span className={`text-[8px] font-bold leading-none ${
                      status === "closed" ? "text-red-400" : "text-slate-400"
                    }`}>{sublabel}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 rounded-2xl bg-card booka-shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Legend</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3">
            {[
              { color: "bg-green-500", label: "Available — tap to select" },
              { color: "bg-slate-200 dark:bg-slate-700", label: "Fully booked" },
              { color: "bg-red-100 border border-red-200", label: "Closed / Holiday" },
              { color: "bg-secondary opacity-40", label: "No slots this day" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded shrink-0 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCalendar;
