export interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  distance: string;
  rating: number;
  address: string;
  phone: string;
  image: string;
  lat: number;
  lng: number;
  timeSlots: TimeSlot[];
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

// Center: Kingston, Jamaica ~18.0179, -76.8099
export const MAP_CENTER = { lat: 18.0179, lng: -76.8099 } as const;

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
    lat: 18.0195,
    lng: -76.8020,
    timeSlots: [
      { id: "1-1", start: "7:00 AM", end: "8:00 AM", available: true },
      { id: "1-2", start: "8:00 AM", end: "9:00 AM", available: true },
      { id: "1-3", start: "9:30 AM", end: "10:30 AM", available: false },
      { id: "1-4", start: "11:00 AM", end: "12:00 PM", available: true },
      { id: "1-5", start: "1:00 PM", end: "2:00 PM", available: true },
      { id: "1-6", start: "3:00 PM", end: "4:00 PM", available: true },
    ],
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
    lat: 18.0145,
    lng: -76.7925,
    timeSlots: [
      { id: "2-1", start: "9:00 AM", end: "10:30 AM", available: true },
      { id: "2-2", start: "10:30 AM", end: "12:00 PM", available: true },
      { id: "2-3", start: "1:00 PM", end: "2:30 PM", available: false },
      { id: "2-4", start: "3:00 PM", end: "4:30 PM", available: true },
    ],
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
    lat: 18.0210,
    lng: -76.7980,
    timeSlots: [
      { id: "3-1", start: "8:00 AM", end: "10:00 AM", available: true },
      { id: "3-2", start: "10:00 AM", end: "12:00 PM", available: true },
      { id: "3-3", start: "1:00 PM", end: "3:00 PM", available: true },
      { id: "3-4", start: "3:00 PM", end: "5:00 PM", available: false },
    ],
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
    lat: 18.0280,
    lng: -76.8050,
    timeSlots: [
      { id: "4-1", start: "8:30 AM", end: "10:00 AM", available: true },
      { id: "4-2", start: "10:30 AM", end: "12:00 PM", available: false },
      { id: "4-3", start: "12:30 PM", end: "2:00 PM", available: true },
      { id: "4-4", start: "2:30 PM", end: "4:00 PM", available: true },
      { id: "4-5", start: "4:30 PM", end: "6:00 PM", available: true },
    ],
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
    lat: 18.0230,
    lng: -76.7880,
    timeSlots: [
      { id: "5-1", start: "7:30 AM", end: "9:30 AM", available: true },
      { id: "5-2", start: "10:00 AM", end: "12:00 PM", available: true },
      { id: "5-3", start: "1:00 PM", end: "3:00 PM", available: true },
    ],
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
    lat: 18.0160,
    lng: -76.7950,
    timeSlots: [
      { id: "6-1", start: "9:00 AM", end: "10:00 AM", available: true },
      { id: "6-2", start: "10:00 AM", end: "11:00 AM", available: false },
      { id: "6-3", start: "11:30 AM", end: "12:30 PM", available: true },
      { id: "6-4", start: "1:00 PM", end: "2:00 PM", available: true },
      { id: "6-5", start: "2:30 PM", end: "3:30 PM", available: true },
      { id: "6-6", start: "4:00 PM", end: "5:00 PM", available: true },
    ],
  },
];
export const defaultTimeSlots: TimeSlot[] = [
  { id: "1", start: "8:00 AM", end: "9:30 AM", available: true },
  { id: "2", start: "9:30 AM", end: "11:00 AM", available: true },
  { id: "3", start: "12:00 PM", end: "1:30 PM", available: false },
  { id: "4", start: "1:30 PM", end: "3:00 PM", available: true },
  { id: "5", start: "3:30 PM", end: "5:00 PM", available: true },
];
