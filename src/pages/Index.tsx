import { useState, useCallback } from "react";
import SplashScreen from "@/components/SplashScreen";
import BottomNav from "@/components/BottomNav";
import MapHome from "@/components/MapHome";
import ProviderList from "@/components/ProviderList";
import StoreProfile from "@/components/StoreProfile";
import PaymentScreen from "@/components/PaymentScreen";
import BookingConfirmation from "@/components/BookingConfirmation";
import BookingsList from "@/components/BookingsList";
import ProfileScreen from "@/components/ProfileScreen";
import { type ServiceProvider, type TimeSlot, type Booking } from "@/data/mockData";

type Screen =
  | { type: "home" }
  | { type: "category"; id: string }
  | { type: "store"; provider: ServiceProvider }
  | { type: "payment"; provider: ServiceProvider; date: string; slot: TimeSlot }
  | { type: "confirmation"; booking: Booking };

type Tab = "home" | "search" | "bookings" | "profile";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>({ type: "home" });
  const [tab, setTab] = useState<Tab>("home");
  const [bookings, setBookings] = useState<Booking[]>([]);

  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  const handleBook = (provider: ServiceProvider, date: string, slot: TimeSlot) => {
    setScreen({ type: "payment", provider, date, slot });
  };

  const handlePaymentConfirm = () => {
    if (screen.type !== "payment") return;
    const { provider, date, slot } = screen;
    const booking: Booking = {
      id: crypto.randomUUID(),
      providerId: provider.id,
      providerName: provider.name,
      date,
      timeSlot: slot,
      status: "Scheduled",
      address: provider.address,
      fee: 750,
    };
    setBookings((prev) => [booking, ...prev]);
    setScreen({ type: "confirmation", booking });
  };

  const handleNavigate = (t: Tab) => {
    setTab(t);
    if (t === "home" || t === "search") setScreen({ type: "home" });
  };

  if (showSplash) return <SplashScreen onComplete={handleSplashComplete} />;

  const renderContent = () => {
    if (tab === "bookings") return <BookingsList bookings={bookings} />;
    if (tab === "profile") return <ProfileScreen />;

    switch (screen.type) {
      case "home":
        return (
          <MapHome
            onSelectCategory={(id) => setScreen({ type: "category", id })}
            onSelectProvider={(p) => setScreen({ type: "store", provider: p })}
          />
        );
      case "category":
        return (
          <ProviderList
            categoryId={screen.id}
            onBack={() => setScreen({ type: "home" })}
            onSelect={(p) => setScreen({ type: "store", provider: p })}
          />
        );
      case "store":
        return (
          <StoreProfile
            provider={screen.provider}
            onBack={() => setScreen({ type: "home" })}
            onBook={handleBook}
          />
        );
      case "payment":
        return (
          <PaymentScreen
            provider={screen.provider}
            date={screen.date}
            slot={screen.slot}
            onBack={() => setScreen({ type: "store", provider: screen.provider })}
            onConfirm={handlePaymentConfirm}
          />
        );
      case "confirmation":
        return (
          <BookingConfirmation
            booking={screen.booking}
            onDone={() => { setScreen({ type: "home" }); setTab("home"); }}
          />
        );
    }
  };

  return (
    <div className="max-w-lg mx-auto relative min-h-screen bg-background">
      {renderContent()}
      <BottomNav active={tab} onNavigate={handleNavigate} />
    </div>
  );
};

export default Index;
