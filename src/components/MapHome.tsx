import { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import mapBg from "@/assets/map-bg.jpg";
import { providers, categories, type ServiceProvider } from "@/data/mockData";

interface MapHomeProps {
  onSelectCategory: (categoryId: string) => void;
  onSelectProvider: (provider: ServiceProvider) => void;
}

const MapHome = ({ onSelectCategory, onSelectProvider }: MapHomeProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
      {/* Map background */}
      <div className="absolute inset-0">
        <img src={mapBg} alt="" className="w-full h-full object-cover" />

        {/* User location dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-4 h-4 rounded-full bg-primary border-[3px] border-primary-foreground booka-shadow" />
          <div
            className="absolute inset-0 w-4 h-4 rounded-full bg-primary/40"
            style={{ animation: "pulse-ring 2s ease-out infinite" }}
          />
        </div>

        {/* Provider pins */}
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectProvider(p)}
            className="absolute z-10 group transition-transform duration-200 hover:scale-110 active:scale-95"
            style={{ top: p.pinPosition.top, left: p.pinPosition.left }}
          >
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center booka-shadow text-primary-foreground text-[10px] font-bold border-2 border-primary-foreground">
              {p.image}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary" />
          </button>
        ))}
      </div>

      {/* Bottom search sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-card rounded-t-3xl transition-all duration-500 ease-out ${
          sheetOpen ? "h-[60vh]" : "h-auto"
        }`}
        style={{ boxShadow: "0 -8px 30px hsl(215 25% 15% / 0.1)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Search bar */}
        <button
          onClick={() => setSheetOpen(!sheetOpen)}
          className="mx-4 mb-4 flex items-center gap-3 w-[calc(100%-2rem)] px-4 py-3.5 bg-secondary rounded-2xl transition-all duration-200 active:scale-[0.98]"
        >
          <MapPin size={20} className="text-primary shrink-0" />
          <span className="text-muted-foreground text-[15px]">Where to?</span>
          <ChevronRight size={18} className="text-muted-foreground ml-auto" />
        </button>

        {/* Categories */}
        {sheetOpen && (
          <div className="px-4 pb-8 fade-in">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Browse Services
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat, i) => (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className="flex items-center gap-3 p-4 bg-secondary rounded-2xl transition-all duration-200 hover:booka-shadow active:scale-[0.97] slide-up"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapHome;
