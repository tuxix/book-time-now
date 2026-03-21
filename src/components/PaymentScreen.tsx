import { useState } from "react";
import { ArrowLeft, Shield, CreditCard } from "lucide-react";
import { type ServiceProvider, type TimeSlot } from "@/data/mockData";
import { format, parseISO } from "date-fns";

interface PaymentScreenProps {
  provider: ServiceProvider;
  date: string;
  slot: TimeSlot;
  onBack: () => void;
  onConfirm: () => void;
}

const COMMITMENT_FEE = 750;

const PaymentScreen = ({ provider, date, slot, onBack, onConfirm }: PaymentScreenProps) => {
  const [processing, setProcessing] = useState(false);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onConfirm();
    }, 1800);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl transition-all duration-200 hover:bg-secondary active:scale-95">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold">Commitment Fee</h1>
      </div>

      <div className="p-5 space-y-5">
        {/* Booking summary */}
        <div className="bg-card rounded-2xl p-5 booka-shadow-sm fade-in">
          <h2 className="font-semibold text-base mb-3">Booking Summary</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Business</span>
              <span className="font-medium">{provider.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{format(parseISO(date), "EEE, MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{slot.start} – {slot.end}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium text-right max-w-[55%]">{provider.address}</span>
            </div>
          </div>
        </div>

        {/* Fee */}
        <div className="bg-card rounded-2xl p-5 booka-shadow-sm fade-in" style={{ animationDelay: "100ms" }}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-base">Commitment Fee</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Secures your booking</p>
            </div>
            <span className="text-2xl font-bold text-primary">J${COMMITMENT_FEE}</span>
          </div>
        </div>

        {/* Card mock */}
        <div className="bg-card rounded-2xl p-5 booka-shadow-sm fade-in" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center gap-3 mb-4">
            <CreditCard size={20} className="text-primary" />
            <h2 className="font-semibold text-base">Payment Method</h2>
          </div>
          <div className="bg-secondary rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-7 rounded bg-booka-deep flex items-center justify-center text-primary-foreground text-[10px] font-bold">
              VISA
            </div>
            <span className="text-sm font-medium">•••• •••• •••• 4827</span>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground fade-in" style={{ animationDelay: "300ms" }}>
          <Shield size={14} className="text-booka-success shrink-0" />
          <span>Payments are secure and encrypted. Fee is non-refundable for no-shows.</span>
        </div>
      </div>

      {/* Pay button */}
      <div className="fixed bottom-16 left-0 right-0 z-30 p-4 bg-card/95 backdrop-blur-md border-t border-border slide-up">
        <button
          onClick={handlePay}
          disabled={processing}
          className="w-full py-4 rounded-2xl booka-gradient text-primary-foreground font-semibold text-base booka-shadow-lg transition-all duration-200 active:scale-[0.97] disabled:opacity-70"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            `Pay J$${COMMITMENT_FEE}`
          )}
        </button>
      </div>
    </div>
  );
};

export default PaymentScreen;
