import { useState, useEffect, useRef } from "react";
import { MapPin, ChevronRight, Star } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { providers, categories, MAP_CENTER, type ServiceProvider } from "@/data/mockData";

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

interface MapHomeProps {
  onSelectCategory: (categoryId: string) => void;
  onSelectProvider: (provider: ServiceProvider) => void;
}

/** Invalidate map size when the sheet opens/closes */
const MapResizer = ({ trigger }: { trigger: boolean }) => {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 350);
  }, [trigger, map]);
  return null;
};

const MapHome = ({ onSelectCategory, onSelectProvider }: MapHomeProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const iconsRef = useRef<Map<string, L.DivIcon>>(new Map());

  const getIcon = (p: ServiceProvider) => {
    if (!iconsRef.current.has(p.id)) {
      iconsRef.current.set(p.id, createProviderIcon(p.image));
    }
    return iconsRef.current.get(p.id)!;
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
      {/* Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[MAP_CENTER.lat, MAP_CENTER.lng]}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full"
          style={{ background: "hsl(215 25% 94%)" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          <MapResizer trigger={sheetOpen} />

          {/* User location */}
          <Marker position={[MAP_CENTER.lat, MAP_CENTER.lng]} icon={userIcon} />

          {/* Provider markers */}
          {providers.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={getIcon(p)}>
              <Popup className="booka-popup" minWidth={180} maxWidth={220}>
                <button
                  onClick={() => onSelectProvider(p)}
                  className="w-full text-left"
                >
                  <p className="font-bold text-sm text-foreground leading-tight">{p.name}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span>{p.rating}</span>
                    <span className="mx-1">·</span>
                    <span>{p.distance}</span>
                  </div>
                  <p className="text-xs text-primary font-semibold mt-1.5">View profile →</p>
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

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
