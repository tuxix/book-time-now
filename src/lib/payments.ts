// ── Payment Integration Scaffold ───────────────────────────────────────────
// This file is the future hook point for Fygaro (and any other payment gateway).
// When payments go live, implement initiatePayment() and handlePaymentCallback().
// Nothing here is called in production yet.

/**
 * FUTURE: Initiate a payment for a confirmed reservation.
 *
 * When Fygaro is active:
 * 1. Build the Fygaro payment URL using the reservation's total_amount.
 * 2. Store the reservation ID in localStorage (for callback recovery).
 * 3. Redirect the customer to the Fygaro payment page.
 * 4. On return, call handlePaymentCallback() to update payment_status.
 *
 * @param reservationId - UUID of the reservation to pay for
 * @param amount        - Amount in JMD (e.g. 5000)
 * @param storeName     - Display name for the payment page note
 */
export async function initiatePayment(
  _reservationId: string,
  _amount: number,
  _storeName: string,
): Promise<void> {
  // ── TODO: Uncomment and configure when Fygaro is ready ────────────────────
  //
  // const buttonId = import.meta.env.VITE_FYGARO_BUTTON_ID ?? "";
  // const note = encodeURIComponent(`Booking at ${_storeName}`);
  // const fygaroUrl =
  //   `https://www.fygaro.com/en/pb/${buttonId}` +
  //   `?amount=${_amount.toFixed(2)}&client_note=${note}&client_reference=${_reservationId}`;
  //
  // try {
  //   localStorage.setItem("rezo_pending_payment", JSON.stringify({ reservationId: _reservationId }));
  // } catch {}
  //
  // window.location.href = fygaroUrl;
  //
  // ── END TODO ──────────────────────────────────────────────────────────────

  console.warn("[Rezo] initiatePayment() called but payment gateway is not yet configured.");
}

/**
 * FUTURE: Handle the return from the Fygaro payment gateway.
 *
 * Called on the /payment-callback route (to be created).
 * Updates payment_status to 'paid' and clears the pending payment from localStorage.
 *
 * @param reservationId - UUID from the Fygaro callback reference
 * @param success       - Whether the payment succeeded
 */
export async function handlePaymentCallback(
  _reservationId: string,
  _success: boolean,
): Promise<void> {
  // ── TODO: Implement when Fygaro callback URL is configured ───────────────
  //
  // const { supabase } = await import("@/integrations/supabase/client");
  // await supabase
  //   .from("reservations")
  //   .update({
  //     payment_status: _success ? "paid" : "failed",
  //     paid_at: _success ? new Date().toISOString() : null,
  //   })
  //   .eq("id", _reservationId);
  //
  // try { localStorage.removeItem("rezo_pending_payment"); } catch {}
  //
  // ── END TODO ──────────────────────────────────────────────────────────────

  console.warn("[Rezo] handlePaymentCallback() called but payment gateway is not yet configured.");
}

/**
 * FUTURE: Calculate commission and store earnings for a reservation.
 * Commission rate: 10% of total_price.
 *
 * @param totalPrice - Full service price in JMD
 * @returns { commissionAmount, storeEarnings }
 */
export function calculateEarnings(totalPrice: number): {
  commissionAmount: number;
  storeEarnings: number;
} {
  const commissionAmount = Math.round(totalPrice * 0.10);
  const storeEarnings = totalPrice - commissionAmount;
  return { commissionAmount, storeEarnings };
}
