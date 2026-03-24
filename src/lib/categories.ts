export const CATEGORIES = [
  { emoji: "✂️",  label: "Barber" },
  { emoji: "💇",  label: "Hair Salon" },
  { emoji: "🐕",  label: "Dog Grooming" },
  { emoji: "💅",  label: "Nail Tech" },
  { emoji: "👁️", label: "Lash Tech" },
  { emoji: "🧖",  label: "Spa & Wellness" },
  { emoji: "🧔",  label: "Beard Grooming" },
  { emoji: "💆",  label: "Massage" },
] as const;

export type Category = (typeof CATEGORIES)[number];

export function getCategoryEmoji(label: string): string {
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
