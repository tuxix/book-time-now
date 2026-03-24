import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, addMonths, subMonths, startOfMonth, getDaysInMonth } from "date-fns";
import { getJamaicanHolidays } from "@/lib/holidays";
import { toast } from "sonner";

interface ClosedDate {
  id: string;
  closed_date: string;
  reason: string;
  is_holiday: boolean;
}

interface Props {
  storeId: string;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CLOSE_REASONS = ["Day Off", "Holiday", "Vacation", "Maintenance", "Custom"];

function calendarCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const pad = first.getDay();
  const total = getDaysInMonth(first);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
  return cells;
}

const StoreCalendar = ({ storeId }: Props) => {
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [reservationCounts, setReservationCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const [actionDate, setActionDate] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [closeReason, setCloseReason] = useState("Day Off");
  const [customReasonText, setCustomReasonText] = useState("");
  const [saving, setSaving] = useState(false);

  const [conflictCount, setConflictCount] = useState(0);
  const [pendingClose, setPendingClose] = useState<{ date: string; reason: string } | null>(null);
  const [conflictDialog, setConflictDialog] = useState(false);

  const [rangeDialog, setRangeDialog] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeReason, setRangeReason] = useState("Vacation");
  const [rangeSaving, setRangeSaving] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(viewDate);
  const monthStr = format(viewDate, "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const holidays = getJamaicanHolidays(year);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const endStr = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

    const [closedRes, reservRes] = await Promise.all([
      supabase
        .from("store_closed_dates")
        .select("id, closed_date, reason, is_holiday")
        .eq("store_id", storeId)
        .gte("closed_date", `${monthStr}-01`)
        .lte("closed_date", endStr),
      supabase
        .from("reservations")
        .select("reservation_date")
        .eq("store_id", storeId)
        .gte("reservation_date", `${monthStr}-01`)
        .lte("reservation_date", endStr)
        .neq("status", "cancelled"),
    ]);

    if (closedRes.data) setClosedDates(closedRes.data as ClosedDate[]);
    if (reservRes.data) {
      const counts = new Map<string, number>();
      for (const r of reservRes.data) {
        counts.set(r.reservation_date, (counts.get(r.reservation_date) || 0) + 1);
      }
      setReservationCounts(counts);
    }
    setLoading(false);
  }, [storeId, monthStr, daysInMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const closedMap = new Map<string, ClosedDate>(closedDates.map((c) => [c.closed_date, c]));

  type DateStatus = "open" | "closed" | "holiday" | "holiday-open";
  const getStatus = (dateStr: string): DateStatus => {
    const row = closedMap.get(dateStr);
    if (row) {
      return row.reason === "Open" ? "holiday-open" : "closed";
    }
    if (holidays.has(dateStr)) return "holiday";
    return "open";
  };

  const openActionDialog = (d: Date) => {
    setActionDate(format(d, "yyyy-MM-dd"));
    setCloseReason("Day Off");
    setCustomReasonText("");
    setActionDialog(true);
  };

  const actionStatus = actionDate ? getStatus(actionDate) : "open";
  const actionRow = actionDate ? closedMap.get(actionDate) : undefined;
  const actionHoliday = actionDate ? holidays.get(actionDate) : undefined;
  const actionBookingCount = actionDate ? (reservationCounts.get(actionDate) || 0) : 0;

  const doMarkClosed = async (dateStr: string, reason: string, count: number) => {
    setSaving(true);
    const { error } = await supabase
      .from("store_closed_dates")
      .insert({ store_id: storeId, closed_date: dateStr, reason, is_holiday: holidays.has(dateStr) });
    if (error) { toast.error("Failed to close date."); setSaving(false); return; }

    if (count > 0) {
      await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("store_id", storeId)
        .eq("reservation_date", dateStr)
        .neq("status", "cancelled");
      toast.success(`Date closed. ${count} booking${count > 1 ? "s" : ""} cancelled.`);
    } else {
      toast.success("Date marked as closed.");
    }
    setSaving(false);
    setActionDialog(false);
    setConflictDialog(false);
    setPendingClose(null);
    setConflictCount(0);
    fetchData();
  };

  const handleMarkClosed = (dateStr: string, reason: string) => {
    const count = reservationCounts.get(dateStr) || 0;
    if (count > 0) {
      setConflictCount(count);
      setPendingClose({ date: dateStr, reason });
      setActionDialog(false);
      setConflictDialog(true);
    } else {
      doMarkClosed(dateStr, reason, 0);
    }
  };

  const handleMarkOpen = async (row: ClosedDate) => {
    setSaving(true);
    const { error } = await supabase.from("store_closed_dates").delete().eq("id", row.id);
    if (error) { toast.error("Failed to re-open date."); setSaving(false); return; }
    toast.success("Date marked as open.");
    setSaving(false);
    setActionDialog(false);
    fetchData();
  };

  const handleHolidayOverride = async (dateStr: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("store_closed_dates")
      .insert({ store_id: storeId, closed_date: dateStr, reason: "Open", is_holiday: true });
    if (error) { toast.error("Failed to override holiday."); setSaving(false); return; }
    toast.success("Holiday overridden — you're open this day.");
    setSaving(false);
    setActionDialog(false);
    fetchData();
  };

  const handleRangeBlock = async () => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      toast.error("Please pick a valid start and end date.");
      return;
    }
    setRangeSaving(true);

    const rows: { store_id: string; closed_date: string; reason: string; is_holiday: boolean }[] = [];
    const cur = new Date(rangeStart + "T00:00:00");
    const end = new Date(rangeEnd + "T00:00:00");

    while (cur <= end) {
      const dateStr = format(cur, "yyyy-MM-dd");
      if (!closedMap.has(dateStr)) {
        rows.push({ store_id: storeId, closed_date: dateStr, reason: rangeReason, is_holiday: holidays.has(dateStr) });
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (rows.length === 0) {
      toast.info("All dates in this range are already blocked.");
      setRangeSaving(false);
      return;
    }

    const { data: bookings } = await supabase
      .from("reservations")
      .select("reservation_date")
      .eq("store_id", storeId)
      .gte("reservation_date", rangeStart)
      .lte("reservation_date", rangeEnd)
      .neq("status", "cancelled");

    const bookingCount = bookings?.length || 0;

    const { error } = await supabase.from("store_closed_dates").insert(rows);
    if (error) { toast.error("Failed to block dates."); setRangeSaving(false); return; }

    if (bookingCount > 0) {
      await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("store_id", storeId)
        .gte("reservation_date", rangeStart)
        .lte("reservation_date", rangeEnd)
        .neq("status", "cancelled");
      toast.success(`${rows.length} date${rows.length > 1 ? "s" : ""} blocked. ${bookingCount} booking${bookingCount > 1 ? "s" : ""} cancelled.`);
    } else {
      toast.success(`${rows.length} date${rows.length > 1 ? "s" : ""} blocked.`);
    }

    setRangeSaving(false);
    setRangeDialog(false);
    setRangeStart("");
    setRangeEnd("");
    fetchData();
  };

  const cells = calendarCells(year, month);

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewDate((d) => subMonths(d, 1))}
            className="p-1.5 rounded-lg hover:bg-secondary active:scale-95 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-sm font-bold px-1 w-36 text-center">{format(viewDate, "MMMM yyyy")}</h2>
          <button
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="p-1.5 rounded-lg hover:bg-secondary active:scale-95 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl text-xs h-8 gap-1.5"
          onClick={() => setRangeDialog(true)}
        >
          <CalendarDays size={12} /> Block Range
        </Button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = format(d, "yyyy-MM-dd");
            const status = getStatus(dateStr);
            const bookings = reservationCounts.get(dateStr) || 0;
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;

            let cellCls = "relative flex flex-col items-center justify-center rounded-lg py-1 min-h-[44px] transition-all active:scale-95 cursor-pointer ";
            let numCls = "text-xs font-semibold ";
            let badgeEl: string | null = null;

            if (status === "closed") {
              cellCls += "bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800";
              numCls += "text-red-700 dark:text-red-300";
              badgeEl = "CLOSED";
            } else if (status === "holiday-open") {
              cellCls += "bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800";
              numCls += "text-green-700 dark:text-green-300";
              badgeEl = "OPEN";
            } else if (status === "holiday") {
              cellCls += "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700";
              numCls += "text-slate-500 dark:text-slate-400";
              badgeEl = "HOL";
            } else {
              cellCls += "bg-card border border-border";
              numCls += "text-foreground";
            }

            if (isPast) cellCls += " opacity-40";
            if (isToday) cellCls += " ring-2 ring-primary ring-offset-1";

            return (
              <button
                key={dateStr}
                data-testid={`calendar-date-${dateStr}`}
                onClick={() => openActionDialog(d)}
                className={cellCls}
              >
                <span className={numCls}>{d.getDate()}</span>
                {badgeEl && (
                  <span className={`text-[7px] font-bold leading-none mt-0.5 ${
                    status === "closed" ? "text-red-500" :
                    status === "holiday-open" ? "text-green-600" :
                    "text-slate-400"
                  }`}>{badgeEl}</span>
                )}
                {bookings > 0 && (
                  <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-[7px] font-bold text-primary-foreground">{bookings > 9 ? "9+" : bookings}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-5 px-1">
        {[
          { color: "bg-card border border-border", label: "Open" },
          { color: "bg-red-100 border border-red-200", label: "Closed" },
          { color: "bg-slate-100 border border-slate-200", label: "Public Holiday" },
          { color: "bg-green-100 border border-green-200", label: "Working on Holiday" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${color} shrink-0`} />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full bg-primary shrink-0" />
          <span className="text-[11px] text-muted-foreground">Has bookings</span>
        </div>
      </div>

      {/* ── Action Dialog ── */}
      <Dialog open={actionDialog} onOpenChange={(o) => { if (!o) setActionDialog(false); }}>
        <DialogContent className="max-w-xs rounded-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {actionDate ? format(new Date(actionDate + "T00:00:00"), "EEEE, MMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionHoliday && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <CalendarDays size={14} className="text-slate-500 shrink-0" />
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{actionHoliday}</p>
              </div>
            )}
            {actionBookingCount > 0 && actionStatus !== "closed" && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                <AlertTriangle size={14} className="text-orange-500 shrink-0" />
                <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                  {actionBookingCount} booking{actionBookingCount > 1 ? "s" : ""} on this day
                </p>
              </div>
            )}

            {actionStatus === "closed" && actionRow && (
              <>
                <p className="text-sm text-center text-muted-foreground">
                  Closed — <span className="font-medium text-foreground">{actionRow.reason}</span>
                </p>
                <Button
                  className="w-full rounded-xl bg-green-600 hover:bg-green-700"
                  onClick={() => handleMarkOpen(actionRow)}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Mark as Open"}
                </Button>
              </>
            )}

            {actionStatus === "holiday-open" && actionRow && (
              <>
                <p className="text-sm text-center text-muted-foreground">You're working on this holiday.</p>
                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  onClick={() => handleMarkOpen(actionRow)}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Close for Holiday"}
                </Button>
              </>
            )}

            {actionStatus === "holiday" && (
              <>
                <p className="text-sm text-center text-muted-foreground">
                  Public holiday — closed by default.
                </p>
                <Button
                  className="w-full rounded-xl bg-green-600 hover:bg-green-700"
                  onClick={() => actionDate && handleHolidayOverride(actionDate)}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "I'm Working This Day"}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  onClick={() => actionDate && handleMarkClosed(actionDate, "Holiday")}
                  disabled={saving}
                >
                  Confirm Closed for Holiday
                </Button>
              </>
            )}

            {actionStatus === "open" && (
              <>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Reason for Closure</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CLOSE_REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setCloseReason(r)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          closeReason === r
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {closeReason === "Custom" && (
                    <input
                      type="text"
                      placeholder="Enter reason…"
                      value={customReasonText}
                      onChange={(e) => setCustomReasonText(e.target.value)}
                      className="mt-2 w-full px-3 py-2 rounded-xl bg-secondary text-sm outline-none"
                    />
                  )}
                </div>
                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  onClick={() => {
                    if (!actionDate) return;
                    const reason = closeReason === "Custom" ? (customReasonText.trim() || "Custom") : closeReason;
                    handleMarkClosed(actionDate, reason);
                  }}
                  disabled={saving}
                >
                  {saving ? "Saving…" : actionBookingCount > 0
                    ? `Close & Cancel ${actionBookingCount} Booking${actionBookingCount > 1 ? "s" : ""}`
                    : "Mark as Closed"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Conflict Dialog ── */}
      <Dialog open={conflictDialog} onOpenChange={(o) => { if (!o) { setConflictDialog(false); setPendingClose(null); } }}>
        <DialogContent className="max-w-xs rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Existing Bookings</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
              <p className="text-sm text-orange-700 dark:text-orange-300">
                <strong>{conflictCount} booking{conflictCount > 1 ? "s" : ""}</strong> exist on this date and will be automatically cancelled.
              </p>
            </div>
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              onClick={() => pendingClose && doMarkClosed(pendingClose.date, pendingClose.reason, conflictCount)}
              disabled={saving}
            >
              {saving ? "Cancelling…" : `Close & Cancel ${conflictCount} Booking${conflictCount > 1 ? "s" : ""}`}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => { setConflictDialog(false); setPendingClose(null); setConflictCount(0); }}
            >
              Keep Bookings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Range Block Dialog ── */}
      <Dialog open={rangeDialog} onOpenChange={(o) => { if (!o) setRangeDialog(false); }}>
        <DialogContent className="max-w-xs rounded-2xl" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Block Date Range</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Start Date</p>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary text-sm outline-none"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">End Date</p>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary text-sm outline-none"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Reason</p>
              <div className="flex flex-wrap gap-1.5">
                {["Day Off", "Vacation", "Holiday Week", "Maintenance"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRangeReason(r)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      rangeReason === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              onClick={handleRangeBlock}
              disabled={rangeSaving || !rangeStart || !rangeEnd}
            >
              {rangeSaving ? "Blocking…" : "Block These Dates"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreCalendar;
