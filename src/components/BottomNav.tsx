import { MapPin, Search, Calendar, User } from "lucide-react";

type Tab = "home" | "search" | "bookings" | "profile";

interface BottomNavProps {
  active: Tab;
  onNavigate: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: typeof MapPin }[] = [
  { id: "home", label: "Explore", icon: MapPin },
  { id: "search", label: "Search", icon: Search },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "profile", label: "Profile", icon: User },
];

const BottomNav = ({ active, onNavigate }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border booka-shadow-lg">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
            >
              <tab.icon
                className="transition-colors duration-200"
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                color={isActive ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))"}
              />
              <span
                className="text-[10px] font-medium transition-colors duration-200"
                style={{ color: isActive ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
