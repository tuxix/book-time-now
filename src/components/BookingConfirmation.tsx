import { CheckCircle2, MapPin, Clock, Calendar } from "lucide-react";
import { type Booking } from "@/data/mockData";
import { format, parseISO } from "date-fns";

interface BookingConfirmationProps {
  booking: Booking;
  onDone: () => void;
}

const BookingConfirmation = ({ booking, onDone }: BookingConfirmationProps) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {/* Success icon */}
        <div className="scale-in mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-booka-success/10 flex items-center justify-center">
            <CheckCircle2 size={44} className="text-booka-success" />
          </div>
        </div>

        <h1 className="text-2xl font-bold fade-in" style={{ animationDelay: "200ms" }}>
          Booking Confirmed!
        </h1>
        <p className="text-sm text-muted-foreground mt-2 fade-in" style={{ animationDelay: "300ms" }}>
          Your appointment has been secured
        </p>

        {/* Details card */}
        <div
          className="mt-8 bg-card rounded-2xl p-5 booka-shadow text-left slide-up"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl booka-gradient flex items-center justify-center text-primary-foreground font-bold shrink-0">
                {booking.providerName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <h3 className="font-semibold">{booking.providerName}</h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-booka-success/10 text-booka-success">
                  {booking.status}
                </span>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-primary shrink-0" />
                <span>{format(parseISO(booking.date), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-primary shrink-0" />
                <span>{booking.timeSlot.start} – {booking.timeSlot.end}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-primary shrink-0" />
                <span>{booking.address}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onDone}
          className="mt-8 w-full py-4 rounded-2xl booka-gradient text-primary-foreground font-semibold booka-shadow-lg transition-all duration-200 active:scale-[0.97] slide-up"
          style={{ animationDelay: "600ms", animationFillMode: "both" }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default BookingConfirmation;
