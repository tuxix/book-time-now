import { useState } from "react";
import { ArrowLeft, Clock, User, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { providers } from "@/data/mockData";
import { format } from "date-fns";

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
  const provider = providers[0]; // default to first provider
  const [enabledSlots, setEnabledSlots] = useState<Set<string>>(
    new Set(provider.timeSlots.map((s) => s.id))
  );

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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Time Slot Configuration
        </h2>
        <div className="space-y-2">
          {provider.timeSlots.map((slot) => (
            <div
              key={slot.id}
              className="bg-card rounded-2xl p-4 booka-shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">{slot.start} – {slot.end}</span>
              </div>
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
