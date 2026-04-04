// ── Platform-Funded Promotions Engine ────────────────────────────────────────
// Rezo absorbs discounts from its 10% commission.
// Store earnings are ALWAYS based on the original total_price, never discounted.

import { supabase } from "@/integrations/supabase/client";

export interface Promotion {
  id: string;
  title: string;
  description?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  applies_to: "all" | "category" | "specific_stores";
  category?: string | null;
  store_ids?: string[] | null;
  created_at: string;
}

/**
 * Return the best active promotion for a given store.
 * "Best" = highest discount_value among all matching active promotions.
 * Returns null if nothing applies.
 *
 * Rules:
 *  - is_active = true
 *  - current time is between start_date and end_date (NULLs treated as open-ended)
 *  - applies_to = "all"              → any store
 *  - applies_to = "category"         → store's primary category must match
 *  - applies_to = "specific_stores"  → store.id must be in store_ids[]
 */
export async function getActivePromotion(
  storeId: string,
  storeCategory: string,
): Promise<Promotion | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`);

  if (error || !data || data.length === 0) return null;

  const applicable = (data as Promotion[]).filter((p) => {
    if (p.applies_to === "all") return true;
    if (p.applies_to === "category") return p.category === storeCategory;
    if (p.applies_to === "specific_stores")
      return (p.store_ids ?? []).includes(storeId);
    return false;
  });

  if (applicable.length === 0) return null;

  // Pick highest discount value
  return applicable.reduce((best, curr) =>
    curr.discount_value > best.discount_value ? curr : best,
  );
}

export interface PromoCalc {
  discountAmount: number;   // what customer saves (capped at Rezo's commission)
  finalPrice: number;       // what customer pays
  commissionAmount: number; // Rezo's standard 10% of original price
  storeEarnings: number;    // original_price × 0.90 — never reduced
  rezoActualCommission: number; // commission after absorbing discount (floor 0)
}

/**
 * Calculate promotion impact on a booking.
 *
 * CRITICAL RULES:
 *  1. storeEarnings = totalPrice × 0.90  (always, discount never touches this)
 *  2. discountAmount is capped at commissionAmount  (Rezo never goes negative)
 *  3. rezoActualCommission = max(0, commission − discount)
 *
 * Examples:
 *  J$2000, 10% → commission=200, discount=200 → Rezo=0, store=1800, customer=1800
 *  J$2000, 50% → cap: discount=200           → Rezo=0, store=1800, customer=1800
 *  J$5000, 5%  → commission=500, discount=250 → Rezo=250, store=4500, customer=4750
 */
export function applyPromotion(totalPrice: number, promo: Promotion): PromoCalc {
  const commissionAmount = Math.round(totalPrice * 0.1);
  const storeEarnings = totalPrice - commissionAmount;

  const rawDiscount =
    promo.discount_type === "percentage"
      ? Math.round((totalPrice * promo.discount_value) / 100)
      : Math.round(promo.discount_value);

  // Cap: Rezo can only give away up to its own commission
  const discountAmount = Math.min(rawDiscount, commissionAmount);
  const finalPrice = totalPrice - discountAmount;
  const rezoActualCommission = Math.max(0, commissionAmount - discountAmount);

  return { discountAmount, finalPrice, commissionAmount, storeEarnings, rezoActualCommission };
}
