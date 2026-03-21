import { useState } from "react";
import { ArrowLeft, Clock, User, CheckCircle2, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { providers, TimeSlot } from "@/data/mockData";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DashboardBooking {
  id: string;
  customerName: string;
  slot: string;
  status: "Scheduled" | "In Progress" | "Completed";
}

const mockBookings: DashboardBooking[] = [
  { id: "1", customerName: "Marcia Thompson", slot: "8:00 AM – 9:30 AM", status: "Completed" },
  { id: "2", customerName: "Andre Williams", slot: "9:30 AM – 11:00 AM", status: "In Progress" },
  { id: "3", customerName: "Keisha Brown", slot: "1:30 PM – 3:00 PM", status: "Scheduled" },
];

const statusStyles: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  Scheduled: { bg: "bg-booka-success/10", text: "text-booka-success", icon: Clock },
  "In Progress": { bg: "bg-primary/10", text: "text-primary", icon: Clock },
  Completed: { bg: "bg-muted", text: "text-muted-foreground", icon: CheckCircle2 },
};

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(mockBookings);
  const provider = providers[0];

  const [slots, setSlots] = useState<TimeSlot[]>(provider.timeSlots);
  const [enabledSlots, setEnabledSlots] = useState<Set<string>>(
    new Set(provider.timeSlots.map((s) => s.id))
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const toggleSlot = (id: string) => {
    setEnabledSlots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cycleStatus = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const order: DashboardBooking["status"][] = ["Scheduled", "In Progress", "Completed"];
        const next = order[(order.indexOf(b.status) + 1) % 3];
        return { ...b, status: next };
      })
    );
  };

  const openAddDialog = () => {
    setEditingSlot(null);
    setStartTime("");
    setEndTime("");
    setDialogOpen(true);
  };

  const openEditDialog = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setStartTime(slot.start);
    setEndTime(slot.end);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!startTime.trim() || !endTime.trim()) return;

    if (editingSlot) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === editingSlot.id ? { ...s, start: startTime.trim(), end: endTime.trim() } : s
        )
      );
    } else {
      const newSlot: TimeSlot = {
        id: `custom-${Date.now()}`,
        start: startTime.trim(),
        end: endTime.trim(),
        available: true,
      };
      setSlots((prev) => [...prev, newSlot]);
      setEnabledSlots((prev) => new Set([...prev, newSlot.id]));
    }
    setDialogOpen(false);
  };

  const removeSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
    setEnabledSlots((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 booka-gradient px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl transition-all duration-200 active:scale-95">
          <ArrowLeft size={22} className="text-primary-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-primary-foreground">Business Dashboard</h1>
          <p className="text-xs text-primary-foreground/70">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>
      </div>

      {/* Today's bookings */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Today's Bookings
        </h2>
        <div className="space-y-2.5">
          {bookings.map((booking, i) => {
            const style = statusStyles[booking.status];
            return (
              <div
                key={booking.id}
                className="bg-card rounded-2xl p-4 booka-shadow-sm slide-up flex items-center gap-3"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <User size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{booking.customerName}</h3>
                  <p className="text-xs text-muted-foreground">{booking.slot}</p>
                </div>
                <button
                  onClick={() => cycleStatus(booking.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${style.bg} ${style.text} transition-all duration-200 active:scale-95`}
                >
                  {booking.status}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time slot config */}
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Time Slot Configuration
          </h2>
          <button
            onClick={openAddDialog}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold transition-all duration-200 active:scale-95"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="bg-card rounded-2xl p-4 booka-shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">{slot.start} – {slot.end}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditDialog(slot)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors duration-150 active:scale-95"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => removeSlot(slot.id)}
                  className="p-1.5 rounded-lg text-destructive/70 hover:bg-destructive/10 transition-colors duration-150 active:scale-95"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => toggleSlot(slot.id)}
                  className={`w-11 h-6 rounded-full transition-all duration-200 relative ${
                    enabledSlots.has(slot.id) ? "bg-primary" : "bg-border"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-primary-foreground booka-shadow-sm absolute top-0.5 transition-all duration-200 ${
                      enabledSlots.has(slot.id) ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
          {slots.length === 0 && (
            <div className="bg-card rounded-2xl p-6 booka-shadow-sm text-center">
              <Clock size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No time slots configured</p>
              <button
                onClick={openAddDialog}
                className="mt-3 text-xs font-semibold text-primary active:scale-95 transition-transform"
              >
                Add your first slot
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingSlot ? "Edit Time Slot" : "Add Time Slot"}</DialogTitle>
            <DialogDescription>
              {editingSlot ? "Update the start and end times." : "Enter a start and end time for the new slot."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time</label>
              <Input
                placeholder="e.g. 9:00 AM"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">End Time</label>
              <Input
                placeholder="e.g. 10:30 AM"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={!startTime.trim() || !endTime.trim()}>
              {editingSlot ? "Update" : "Add Slot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProviderDashboard;
