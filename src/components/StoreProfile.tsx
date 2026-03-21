import { useState } from "react";
import { ArrowLeft, Star, MapPin, Phone, Clock } from "lucide-react";
import { format, addDays } from "date-fns";
import { type ServiceProvider, type TimeSlot } from "@/data/mockData";

interface StoreProfileProps {
  provider: ServiceProvider;
  onBack: () => void;
  onBook: (provider: ServiceProvider, date: string, slot: TimeSlot) => void;
}

const StoreProfile = ({ provider, onBack, onBook }: StoreProfileProps) => {
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const slot = provider.timeSlots.find((s) => s.id === selectedSlot);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background pb-28">
      {/* Hero */}
      <div className="relative h-44 booka-gradient flex items-end">
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 rounded-xl bg-primary-foreground/20 backdrop-blur-sm transition-all duration-200 active:scale-95"
        >
          <ArrowLeft size={22} className="text-primary-foreground" />
        </button>
        <div className="p-5 pb-0 translate-y-8 flex items-end gap-4">
          <div className="w-20 h-20 rounded-2xl bg-card flex items-center justify-center text-2xl font-bold text-primary booka-shadow-lg border-4 border-card">
            {provider.image}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-5 pt-12">
        <h1 className="text-xl font-bold">{provider.name}</h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star size={14} className="text-booka-warning fill-booka-warning" />
            <span className="font-medium text-foreground">{provider.rating}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <MapPin size={14} />
            <span>{provider.distance}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
          <MapPin size={13} /> {provider.address}
        </p>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Phone size={13} /> {provider.phone}
        </p>
      </div>

      {/* Date picker */}
      <div className="mt-6 px-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock size={14} /> Select Date
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {dates.map((date, i) => (
            <button
              key={i}
              onClick={() => { setSelectedDate(i); setSelectedSlot(null); }}
              className={`flex flex-col items-center px-4 py-3 rounded-2xl shrink-0 transition-all duration-200 active:scale-95 ${
                selectedDate === i
                  ? "booka-gradient text-primary-foreground booka-shadow"
                  : "bg-secondary text-foreground"
              }`}
            >
              <span className="text-[10px] font-medium uppercase opacity-70">
                {format(date, "EEE")}
              </span>
              <span className="text-lg font-bold leading-tight">{format(date, "d")}</span>
              <span className="text-[10px] opacity-70">{format(date, "MMM")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time slots */}
      <div className="mt-6 px-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Available Slots
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {defaultTimeSlots.map((ts, i) => (
            <button
              key={ts.id}
              disabled={!ts.available}
              onClick={() => setSelectedSlot(ts.id)}
              className={`p-3.5 rounded-2xl text-sm font-medium transition-all duration-200 active:scale-[0.97] slide-up ${
                !ts.available
                  ? "bg-muted text-muted-foreground/40 cursor-not-allowed"
                  : selectedSlot === ts.id
                  ? "booka-gradient text-primary-foreground booka-shadow"
                  : "bg-card booka-shadow-sm text-foreground hover:booka-shadow"
              }`}
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            >
              {ts.start} – {ts.end}
            </button>
          ))}
        </div>
      </div>

      {/* Reserve button */}
      {selectedSlot && slot && (
        <div className="fixed bottom-16 left-0 right-0 z-30 p-4 bg-card/95 backdrop-blur-md border-t border-border slide-up">
          <button
            onClick={() => onBook(provider, format(dates[selectedDate], "yyyy-MM-dd"), slot)}
            className="w-full py-4 rounded-2xl booka-gradient text-primary-foreground font-semibold text-base booka-shadow-lg transition-all duration-200 active:scale-[0.97]"
          >
            Reserve Slot · {slot.start}
          </button>
        </div>
      )}
    </div>
  );
};

export default StoreProfile;
