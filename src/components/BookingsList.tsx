import { Calendar, Clock, MapPin } from "lucide-react";
import { type Booking } from "@/data/mockData";
import { format, parseISO } from "date-fns";

interface BookingsListProps {
  bookings: Booking[];
}

const statusColors: Record<string, string> = {
  Scheduled: "bg-booka-success/10 text-booka-success",
  "In Progress": "bg-primary/10 text-primary",
  Completed: "bg-muted text-muted-foreground",
};

const BookingsList = ({ bookings }: BookingsListProps) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {bookings.length === 0 ? "No bookings yet" : `${bookings.length} booking${bookings.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center px-8 fade-in">
          <Calendar size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">
            Book your first appointment to see it here
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {bookings.map((booking, i) => (
            <div
              key={booking.id}
              className="bg-card rounded-2xl p-4 booka-shadow-sm slide-up"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl booka-gradient flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {booking.providerName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[15px]">{booking.providerName}</h3>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-full ${statusColors[booking.status]}`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">J${booking.fee}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar size={12} /> {format(parseISO(booking.date), "MMM d")}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {booking.timeSlot.start}</span>
                <span className="flex items-center gap-1 truncate"><MapPin size={12} /> {booking.address}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingsList;
