export interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  distance: string;
  rating: number;
  address: string;
  phone: string;
  image: string;
  pinPosition: { top: string; left: string };
}

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  available: boolean;
}

export interface Booking {
  id: string;
  providerId: string;
  providerName: string;
  date: string;
  timeSlot: TimeSlot;
  status: "Scheduled" | "In Progress" | "Completed";
  address: string;
  fee: number;
}

export const categories = [
  { id: "barber", label: "Barber", icon: "✂️" },
  { id: "hair-salon", label: "Hair Salon", icon: "💇" },
  { id: "dog-grooming", label: "Dog Grooming", icon: "🐕" },
  { id: "nail-tech", label: "Nail Tech", icon: "💅" },
];

export const providers: ServiceProvider[] = [
  {
    id: "1",
    name: "Kingsway Kutz",
    category: "barber",
    distance: "0.8 km",
    rating: 4.8,
    address: "12 Kingsway Ave, Kingston 10",
    phone: "+1 876-555-0101",
    image: "KK",
    pinPosition: { top: "35%", left: "55%" },
  },
  {
    id: "2",
    name: "Fresh Fades Studio",
    category: "barber",
    distance: "1.2 km",
    rating: 4.6,
    address: "45 Hope Road, Kingston 6",
    phone: "+1 876-555-0102",
    image: "FF",
    pinPosition: { top: "50%", left: "30%" },
  },
  {
    id: "3",
    name: "Glamour Hair Lounge",
    category: "hair-salon",
    distance: "0.5 km",
    rating: 4.9,
    address: "8 Trafalgar Road, Kingston 10",
    phone: "+1 876-555-0103",
    image: "GH",
    pinPosition: { top: "25%", left: "40%" },
  },
  {
    id: "4",
    name: "Crown & Glory Salon",
    category: "hair-salon",
    distance: "2.1 km",
    rating: 4.5,
    address: "22 Constant Spring Rd, Kingston 8",
    phone: "+1 876-555-0104",
    image: "CG",
    pinPosition: { top: "60%", left: "65%" },
  },
  {
    id: "5",
    name: "Pawfect Grooming",
    category: "dog-grooming",
    distance: "1.8 km",
    rating: 4.7,
    address: "5 Barbican Road, Kingston 6",
    phone: "+1 876-555-0105",
    image: "PG",
    pinPosition: { top: "45%", left: "70%" },
  },
  {
    id: "6",
    name: "Nailz by Tanya",
    category: "nail-tech",
    distance: "0.6 km",
    rating: 4.9,
    address: "33 Lady Musgrave Rd, Kingston 5",
    phone: "+1 876-555-0106",
    image: "NT",
    pinPosition: { top: "40%", left: "20%" },
  },
];

export const defaultTimeSlots: TimeSlot[] = [
  { id: "1", start: "8:00 AM", end: "9:30 AM", available: true },
  { id: "2", start: "9:30 AM", end: "11:00 AM", available: true },
  { id: "3", start: "12:00 PM", end: "1:30 PM", available: false },
  { id: "4", start: "1:30 PM", end: "3:00 PM", available: true },
  { id: "5", start: "3:30 PM", end: "5:00 PM", available: true },
];
