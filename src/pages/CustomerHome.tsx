import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Calendar, User, LogOut, Star, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CustomerBooking from "@/components/CustomerBooking";
import CustomerReservations from "@/components/CustomerReservations";

declare global {
  interface Window { L: any; }
}

interface Store {
  id: string;
  name: string;
  description: string;
  address: string;
  category: string;
  rating: number;
  review_count: number;
  latitude: number | null;
  longitude: number | null;
}

// Default centre — Kingston, Jamaica
const DEFAULT_CENTER: [number, number] = [17.9970, -76.7936];

// Stable pseudo-random offset based on store id so pins don't jump on re-render
function stableOffset(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i);
  }
  return ((h >>> 0) / 0xffffffff - 0.5) * 0.05; // ±0.025 degrees
}

type Tab = "browse" | "bookings" | "profile";

const CustomerHome = () => {
  const { user, signOut } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [loadingStores, setLoadingStores] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  // ── Fetch stores ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("stores")
      .select("id, name, description, address, category, rating, review_count, latitude, longitude")
      .then(({ data, error }) => {
        console.log("[Booka] stores response:", { data, error });
        if (error) {
          console.error("[Booka] stores error:", error.message, error.code);
          setStoreError(error.message);
        } else {
          setStores((data ?? []) as Store[]);
        }
        setLoadingStores(false);
      });
  }, []);

  // ── Build / update markers whenever stores or highlight changes ───────────
  const refreshMarkers = useCallback(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || stores.length === 0) return;

    stores.forEach((store) => {
      const lat = store.latitude ?? DEFAULT_CENTER[0] + stableOffset(store.id, 0);
      const lng = store.longitude ?? DEFAULT_CENTER[1] + stableOffset(store.id, 1);
      const initials = store.name.slice(0, 2).toUpperCase();
      const selected = store.id === highlightedId;

      const html = `<div class="booka-pin${selected ? " booka-pin--active" : ""}"><span>${initials}</span></div>`;
      const icon = L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 18] });

      if (markersRef.current[store.id]) {
        markersRef.current[store.id].setIcon(icon);
      } else {
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.on("click", () => {
          setHighlightedId(store.id);
          cardRefs.current[store.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        markersRef.current[store.id] = marker;
      }
    });
  }, [stores, highlightedId]);

  // ── Initialise Leaflet map ────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "browse") return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) {
      refreshMarkers();
      return;
    }

    const L = window.L;
    if (!L) { console.error("[Booka] Leaflet not available on window.L"); return; }

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    // User location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          map.setView([coords.latitude, coords.longitude], 15);
          const dot = L.divIcon({
            className: "",
            html: '<div class="booka-user-dot"><div class="booka-user-ring"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          L.marker([coords.latitude, coords.longitude], { icon: dot }).addTo(map);
        },
        () => { /* denied — stay at default */ }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Add markers when stores arrive or selection changes
  useEffect(() => {
    refreshMarkers();
  }, [refreshMarkers]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.category || "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Booking view ──────────────────────────────────────────────────────────
  if (selectedStore) {
    return <CustomerBooking store={selectedStore} onBack={() => setSelectedStore(null)} />;
  }

  const tabs = [
    { id: "browse" as Tab, label: "Map", icon: MapPin },
    { id: "bookings" as Tab, label: "Bookings", icon: Calendar },
    { id: "profile" as Tab, label: "Profile", icon: User },
  ];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background flex flex-col" style={{ paddingBottom: 56 }}>

      {/* ── Browse / Map tab ── */}
      {tab === "browse" && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>

          {/* Map — 62 vh */}
          <div style={{ height: "62%", position: "relative", flexShrink: 0 }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

            {/* Floating search bar */}
            <div className="absolute top-3 left-3 right-3 z-[400] pointer-events-auto">
              <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md rounded-2xl px-3 booka-shadow border border-border">
                <Search size={16} className="text-muted-foreground shrink-0" />
                <Input
                  data-testid="input-store-search"
                  placeholder="Search stores or categories…"
                  className="border-0 bg-transparent h-11 focus-visible:ring-0 text-sm px-0"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Store tray — scrollable lower 38% */}
          <div className="flex-1 overflow-y-auto bg-background">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {loadingStores
                  ? "Loading…"
                  : `${filtered.length} store${filtered.length !== 1 ? "s" : ""} nearby`}
              </p>
            </div>

            {storeError && (
              <div
                data-testid="status-store-error"
                className="mx-4 mb-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs"
              >
                Could not load stores: {storeError}
              </div>
            )}

            {loadingStores ? (
              <div className="space-y-2 px-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-2xl bg-secondary animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {search ? "No stores match your search" : "No stores available yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 px-4 pb-4">
                {filtered.map((store) => {
                  const active = store.id === highlightedId;
                  return (
                    <button
                      key={store.id}
                      data-testid={`card-store-${store.id}`}
                      ref={(el) => { cardRefs.current[store.id] = el; }}
                      onClick={() => {
                        setHighlightedId(store.id);
                        // Pan map to store
                        if (mapRef.current) {
                          const lat = store.latitude ?? DEFAULT_CENTER[0] + stableOffset(store.id, 0);
                          const lng = store.longitude ?? DEFAULT_CENTER[1] + stableOffset(store.id, 1);
                          mapRef.current.setView([lat, lng], 16, { animate: true });
                        }
                        setSelectedStore(store);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 active:scale-[0.98] text-left ${
                        active
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-card booka-shadow-sm hover:booka-shadow border border-transparent"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                        {store.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{store.category || "Service"}</p>
                        {store.address ? (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {store.address}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 text-xs shrink-0">
                        <Star size={12} className="text-amber-500 fill-amber-500" />
                        <span className="font-medium text-foreground">
                          {store.review_count > 0 ? store.rating : "New"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bookings tab ── */}
      {tab === "bookings" && <CustomerReservations />}

      {/* ── Profile tab ── */}
      {tab === "profile" && (
        <div className="px-5 pt-6 space-y-4 fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full booka-gradient flex items-center justify-center text-primary-foreground text-lg font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold">{displayName}</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button
            data-testid="button-sign-out"
            variant="outline"
            className="w-full rounded-xl gap-2"
            onClick={signOut}
          >
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-[600] bg-card/95 backdrop-blur-md border-t border-border booka-shadow-lg">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((t) => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
            >
              <t.icon
                size={22}
                strokeWidth={tab === t.id ? 2.5 : 1.8}
                color={tab === t.id ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))"}
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color: tab === t.id ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))",
                }}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CustomerHome;
