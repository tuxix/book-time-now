export const CATEGORIES = [
  { emoji: "✂️",  label: "Barber" },
  { emoji: "💇",  label: "Hair Salon" },
  { emoji: "💅",  label: "Nail Tech" },
  { emoji: "🐕",  label: "Dog Grooming" },
  { emoji: "👁️", label: "Lash Tech" },
  { emoji: "🧖",  label: "Spa and Wellness" },
  { emoji: "💆",  label: "Massage" },
] as const;

export type Category = (typeof CATEGORIES)[number];

export function getCategoryEmoji(label: string): string {
  if (label === "Barber and Beard" || label === "Beard Grooming") return "✂️";
  if (label === "Spa & Wellness") return "🧖";
  return CATEGORIES.find((c) => c.label === label)?.emoji ?? "💼";
}

export function distanceKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): string {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return "";
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? "s" : ""} ago`;
}

export const DAILY_LIMITS: Record<string, number> = {
  "Barber": 10,
  "Barber and Beard": 10,
  "Hair Salon": 5,
  "Nail Tech": 5,
  "Dog Grooming": 5,
  "Lash Tech": 5,
  "Spa and Wellness": 8,
  "Massage": 8,
};

export const CATEGORY_DURATIONS: Record<string, { default: number; min: number; max: number }> = {
  "Barber": { default: 30, min: 10, max: 30 },
  "Barber and Beard": { default: 30, min: 10, max: 30 },
  "Hair Salon": { default: 120, min: 30, max: 240 },
  "Nail Tech": { default: 60, min: 30, max: 90 },
  "Dog Grooming": { default: 120, min: 60, max: 240 },
  "Lash Tech": { default: 90, min: 45, max: 120 },
  "Spa and Wellness": { default: 60, min: 30, max: 90 },
  "Massage": { default: 60, min: 30, max: 90 },
};

export const DEFAULT_SERVICES: Record<string, { name: string; price: number; duration: number }[]> = {
  "Barber": [
    { name: "Haircut", price: 1500, duration: 30 },
    { name: "Fade", price: 2000, duration: 30 },
    { name: "Kids Cut", price: 1200, duration: 20 },
    { name: "Shape Up and Lineup", price: 800, duration: 15 },
    { name: "Haircut and Beard", price: 2500, duration: 45 },
    { name: "Full Service", price: 3500, duration: 60 },
  ],
  "Barber and Beard": [
    { name: "Haircut", price: 1500, duration: 30 },
    { name: "Fade", price: 2000, duration: 30 },
    { name: "Kids Cut", price: 1200, duration: 20 },
    { name: "Shape Up and Lineup", price: 800, duration: 15 },
    { name: "Haircut and Beard", price: 2500, duration: 45 },
    { name: "Full Service", price: 3500, duration: 60 },
  ],
  "Hair Salon": [
    { name: "Wash and Set", price: 3000, duration: 60 },
    { name: "Trim", price: 2000, duration: 45 },
    { name: "Blowout", price: 3500, duration: 60 },
    { name: "Relaxer", price: 5000, duration: 120 },
    { name: "Braids", price: 8000, duration: 240 },
    { name: "Twist", price: 6000, duration: 180 },
    { name: "Wig Install", price: 7000, duration: 120 },
    { name: "Weave Install", price: 10000, duration: 180 },
    { name: "Colour", price: 8000, duration: 120 },
  ],
  "Nail Tech": [
    { name: "Basic Manicure", price: 2000, duration: 45 },
    { name: "Gel Manicure", price: 3500, duration: 60 },
    { name: "Acrylic Full Set", price: 5000, duration: 90 },
    { name: "Nail Fill", price: 3000, duration: 60 },
    { name: "Basic Pedicure", price: 2500, duration: 45 },
    { name: "Gel Pedicure", price: 4000, duration: 60 },
    { name: "Nail Art", price: 5500, duration: 90 },
  ],
  "Dog Grooming": [
    { name: "Bath and Dry", price: 3000, duration: 60 },
    { name: "Bath and Trim", price: 4500, duration: 90 },
    { name: "Full Groom", price: 6000, duration: 120 },
    { name: "Nail Trim", price: 1500, duration: 20 },
    { name: "Ear Cleaning", price: 1000, duration: 15 },
    { name: "Teeth Brushing", price: 1000, duration: 15 },
    { name: "Dematting", price: 2000, duration: 60 },
  ],
  "Lash Tech": [
    { name: "Classic Full Set", price: 5000, duration: 90 },
    { name: "Hybrid Full Set", price: 6000, duration: 100 },
    { name: "Volume Full Set", price: 7000, duration: 120 },
    { name: "Lash Fill", price: 3500, duration: 60 },
    { name: "Lash Removal", price: 2000, duration: 30 },
    { name: "Bottom Lashes", price: 3000, duration: 45 },
  ],
  "Spa and Wellness": [
    { name: "Swedish Massage 30 mins", price: 4000, duration: 30 },
    { name: "Swedish Massage 60 mins", price: 7000, duration: 60 },
    { name: "Deep Tissue 60 mins", price: 9000, duration: 60 },
    { name: "Facial", price: 6000, duration: 60 },
    { name: "Body Scrub", price: 7000, duration: 60 },
    { name: "Manicure and Pedicure", price: 5000, duration: 90 },
    { name: "Hot Stone 60 mins", price: 10000, duration: 60 },
  ],
  "Massage": [
    { name: "Relaxation 30 mins", price: 4000, duration: 30 },
    { name: "Relaxation 60 mins", price: 7000, duration: 60 },
    { name: "Deep Tissue 60 mins", price: 9000, duration: 60 },
    { name: "Hot Stone 60 mins", price: 10000, duration: 60 },
    { name: "Couples Massage 60 mins", price: 15000, duration: 60 },
    { name: "Sports Massage 60 mins", price: 9000, duration: 60 },
  ],
};
