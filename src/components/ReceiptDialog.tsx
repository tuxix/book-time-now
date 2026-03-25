import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { getCategoryEmoji } from "@/lib/categories";

export interface SelectedOption {
  group_label: string;
  item_label: string;
  price_modifier: number;
}

export interface ReservationServiceData {
  service_name: string;
  base_price: number;
  selected_options: SelectedOption[];
  options_total: number;
  subtotal: number;
}

export interface ReceiptReservation {
  id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: string;
  cancelled_by?: string;
  fee?: number;
  stores: {
    name: string;
    category?: string;
    address?: string;
    commitment_fee?: number;
  } | null;
}

interface Props {
  reservation: ReceiptReservation;
  customerName?: string;
  service?: ReservationServiceData | null;
  open: boolean;
  onClose: () => void;
}

const fmt = (p: number) => `J$${Number(p).toFixed(0)}`;

const paymentStatus = (status: string, cancelledBy?: string) => {
  if (status === "completed") return { label: "Paid", cls: "text-green-600" };
  if (status === "cancelled")
    return cancelledBy === "store"
      ? { label: "Refunded", cls: "text-blue-600" }
      : { label: "Forfeited", cls: "text-amber-600" };
  return { label: "Pending", cls: "text-muted-foreground" };
};

const apptStatusLabel = (status: string, cancelledBy?: string) => {
  if (status === "completed") return "Completed";
  if (status === "cancelled")
    return cancelledBy === "store" ? "Cancelled by Store" : "Cancelled by Customer";
  return status.replace("_", " ");
};

const ReceiptDialog = ({ reservation: r, customerName, service, open, onClose }: Props) => {
  const ref = r.id.split("-")[0].toUpperCase();
  const emoji = getCategoryEmoji(r.stores?.category ?? "");
  const commitmentFee = r.stores?.commitment_fee ?? 750;
  const total = service ? service.subtotal + commitmentFee : commitmentFee;
  const pStatus = paymentStatus(r.status, r.cancelled_by);
  const apptStatus = apptStatusLabel(r.status, r.cancelled_by);
  const generatedAt = format(new Date(), "MMM d, yyyy 'at' h:mm a");

  const handlePrint = () => {
    const content = document.getElementById("receipt-print-content")?.innerHTML ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<title>Receipt #${ref}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; max-width: 380px; margin: 0 auto; color: #111; }
  .header-emoji { font-size: 28px; }
  h2 { font-size: 18px; font-weight: 800; margin: 0; }
  .sub { font-size: 11px; color: #666; margin: 2px 0 4px; }
  .section { border-top: 1px solid #e5e7eb; padding: 10px 0; }
  .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 3px; }
  .value { font-size: 13px; font-weight: 600; }
  .row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 3px; }
  .row-muted { color: #666; }
  .total-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 6px; }
  .total-label { font-weight: 700; font-size: 14px; }
  .total-val { font-weight: 900; font-size: 20px; color: #2563eb; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .footer { text-align: center; font-size: 10px; color: #999; margin-top: 16px; }
  .ref { font-family: monospace; font-size: 22px; font-weight: 900; color: #2563eb; letter-spacing: 0.15em; }
</style>
</head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm rounded-2xl max-h-[88vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-bold">Receipt</DialogTitle>
        </DialogHeader>

        <div id="receipt-print-content" className="text-sm space-y-0">
          {/* Store header */}
          <div className="pb-4 flex items-start gap-3">
            <span className="text-3xl leading-none mt-0.5">{emoji}</span>
            <div>
              <p className="font-extrabold text-foreground text-base leading-tight">{r.stores?.name || "Store"}</p>
              {r.stores?.category && <p className="text-xs text-muted-foreground">{r.stores.category}</p>}
              {r.stores?.address && <p className="text-xs text-muted-foreground mt-0.5">📍 {r.stores.address}</p>}
            </div>
          </div>

          {/* Ref + generated */}
          <div className="py-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Booking Reference</p>
            <p className="text-2xl font-extrabold font-mono text-primary tracking-widest mt-0.5">#{ref}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Generated {generatedAt}</p>
          </div>

          {/* Customer */}
          {customerName && (
            <div className="py-3 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer</p>
              <p className="font-semibold text-foreground mt-0.5">{customerName}</p>
            </div>
          )}

          {/* Appointment */}
          <div className="py-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Appointment</p>
            <p className="font-semibold text-foreground mt-0.5">
              {format(parseISO(r.reservation_date), "MMMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">{r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</p>
          </div>

          {/* Price breakdown */}
          <div className="py-3 border-t border-border space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Price Breakdown</p>
            {service ? (
              <>
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>{service.service_name}</span>
                  <span>{fmt(service.base_price)}</span>
                </div>
                {service.selected_options.map((opt, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                      {opt.group_label}: {opt.item_label}
                    </span>
                    <span>{opt.price_modifier > 0 ? `+${fmt(opt.price_modifier)}` : opt.price_modifier === 0 ? "Included" : fmt(opt.price_modifier)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                  <span>Service subtotal</span>
                  <span>{fmt(service.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Commitment fee</span>
                  <span>+{fmt(commitmentFee)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Commitment fee</span>
                <span>{fmt(commitmentFee)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-bold text-foreground text-sm">Total Paid</span>
              <span className="text-2xl font-extrabold text-primary">{fmt(total)}</span>
            </div>
          </div>

          {/* Payment + Appt status */}
          <div className="py-3 border-t border-border grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payment</p>
              <p className={`text-xs font-bold mt-0.5 ${pStatus.cls}`}>{pStatus.label}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Appointment</p>
              <p className="text-xs font-bold mt-0.5 text-foreground">{apptStatus}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="py-3 border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Thank you for using Booka!<br />We look forward to seeing you again.
            </p>
          </div>
        </div>

        <Button variant="outline" className="w-full rounded-xl gap-2" onClick={handlePrint}>
          <Printer size={14} /> Download / Print Receipt
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptDialog;
