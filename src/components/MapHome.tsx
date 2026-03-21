import { useState, useEffect, useRef } from "react";
import { MapPin, ChevronRight, Star } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { providers, categories, MAP_CENTER, type ServiceProvider } from "@/data/mockData";

interface MapHomeProps {
  onSelectCategory: (categoryId: string) => void;
  onSelectProvider: (provider: ServiceProvider) => void;
}

const createProviderIcon = (label: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:hsl(215 90% 52%);color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:10px;font-weight:700;
      border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.25);
    ">${label}</div>
    <div style="
      width:0;height:0;margin:-2px auto 0;
      border-left:6px solid transparent;
      border-right:6px solid transparent;
      border-top:8px solid hsl(215 90% 52%);
    "></div>`,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -48],
  });

const userIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:hsl(215 90% 52%);
    border:3px solid #fff;
    box-shadow:0 0 0 4px hsl(215 90% 52% / .3), 0 2px 6px rgba(0,0,0,.2);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const MapHome = ({ onSelectCategory, onSelectProvider }: MapHomeProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [MAP_CENTER.lat, MAP_CENTER.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    // User location marker
    L.marker([MAP_CENTER.lat, MAP_CENTER.lng], { icon: userIcon }).addTo(map);

    // Provider markers
    providers.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: createProviderIcon(p.image) }).addTo(map);
      marker.bindPopup(
        `<div style="min-width:160px;font-family:inherit;">
          <p style="font-weight:700;font-size:14px;margin:0 0 4px;">${p.name}</p>
          <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:#6b7280;">
            <span>⭐ ${p.rating}</span>
            <span>·</span>
            <span>${p.distance}</span>
          </div>
          <p class="booka-popup-link" style="font-size:12px;color:hsl(215 90% 52%);font-weight:600;margin:6px 0 0;cursor:pointer;">View profile →</p>
        </div>`,
        { closeButton: false }
      );
      marker.on("popupopen", () => {
        setTimeout(() => {
          const link = document.querySelector(".booka-popup-link");
          if (link) {
            (link as HTMLElement).onclick = () => onSelectProvider(p);
          }
        }, 0);
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onSelectProvider]);

  // Invalidate size when sheet opens/closes
  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 350);
  }, [sheetOpen]);

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
      {/* Leaflet Map */}
      <div ref={containerRef} className="absolute inset-0 z-0" style={{ background: "hsl(215 25% 94%)" }} />

      {/* Bottom search sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-[1000] bg-card rounded-t-3xl transition-all duration-500 ease-out ${
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
          <div className="px-4 pb-8 fade-in overflow-y-auto" style={{ maxHeight: "calc(60vh - 6rem)" }}>
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
