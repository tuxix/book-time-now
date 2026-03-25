import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, Calendar, User, MapPin, ChevronRight, Star,
  X, Briefcase, Settings, HelpCircle, LogOut, Heart, Mic,
} from "lucide-react";
import { CATEGORIES, distanceKm, getCategoryEmoji } from "@/lib/categories";
import { type Store } from "@/components/StoreProfile";
import StoreProfile from "@/components/StoreProfile";
import CategoryResults from "@/components/CategoryResults";
import SearchScreen from "@/components/SearchScreen";
import CustomerBooking from "@/components/CustomerBooking";
import CustomerReservations from "@/components/CustomerReservations";
import { toast } from "sonner";

declare global { interface Window { L: any; } }

const DEFAULT_CENTER: [number, number] = [17.9970, -76.7936];

function stableOffset(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i);
  return ((h >>> 0) / 0xffffffff - 0.5) * 0.04;
}

type Tab = "explore" | "search" | "bookings" | "profile";

// ── Profile tab ───────────────────────────────────────────────────────────────
interface ProfileTabProps {
  onSwitchToDashboard?: () => void;
  stores: Store[];
  favStoreIds: Set<string>;
  onToggleFav: (id: string) => void;
  userLocation: [number, number] | null;
  onViewStore: (store: Store) => void;
}

const ProfileTab = ({ onSwitchToDashboard, stores, favStoreIds, onToggleFav, userLocation, onViewStore }: ProfileTabProps) => {
  const { user, profile, signOut } = useAuth();
  const [newBookingCount, setNewBookingCount] = useState(0);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] || "Customer";

  useEffect(() => {
    if (profile?.role !== "store" || !user) return;
    (async () => {
      const { data: storeData } = await supabase
        .from("stores").select("id").eq("user_id", user.id).maybeSingle();
      if (!storeData) return;
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("reservations")
        .select("id", { count: "exact" })
        .eq("store_id", storeData.id)
        .eq("status", "scheduled")
        .eq("reservation_date", today);
      setNewBookingCount(count ?? 0);
    })();
  }, [user, profile]);

  const initials = displayName.slice(0, 2).toUpperCase();

  const menuItems = [
    { icon: User, label: "Edit Profile" },
    { icon: Settings, label: "Settings" },
    { icon: HelpCircle, label: "Help & Support" },
  ];

  const favStores = stores.filter((s) => favStoreIds.has(s.id));

  return (
    <div className="absolute inset-x-0 top-0 overflow-y-auto bg-background fade-in" style={{ bottom: 56 }}>
      <div className="px-5 pt-8 pb-5 flex flex-col items-center border-b border-border">
        <div
          className="w-20 h-20 rounded-full booka-gradient flex items-center justify-center text-primary-foreground text-2xl font-bold mb-3"
          style={{ boxShadow: "0 0 0 4px hsl(213 82% 48% / 0.15), 0 8px 24px -4px hsl(213 82% 48% / 0.3)" }}
        >
          {initials}
        </div>
        <h1 className="text-lg font-bold text-foreground">{displayName}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {onSwitchToDashboard && (
          <button
            data-testid="button-switch-dashboard"
            onClick={onSwitchToDashboard}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 transition-all active:scale-[0.98] menu-item-animate relative overflow-hidden"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Briefcase size={18} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Switch to Business Dashboard</p>
              <p className="text-xs text-muted-foreground">Manage your store</p>
            </div>
            {newBookingCount > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                {newBookingCount}
              </span>
            )}
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </button>
        )}

        {menuItems.map((item, idx) => (
          <button
            key={item.label}
            onClick={() => toast.info("Coming soon!")}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left transition-all active:scale-[0.98] menu-item-animate"
            style={{ animationDelay: `${(idx + (onSwitchToDashboard ? 1 : 0)) * 40}ms` }}
          >
            <item.icon size={18} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}

        {/* Favourites section */}
        <div className="pt-3">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={15} className="text-red-500 fill-red-500" />
            <h2 className="text-sm font-bold text-foreground">My Favourites</h2>
            {favStores.length > 0 && (
              <span className="text-xs text-muted-foreground">({favStores.length})</span>
            )}
          </div>
          {favStores.length === 0 ? (
            <div className="p-5 rounded-2xl bg-secondary text-center">
              <Heart size={24} className="mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-xs text-muted-foreground">Tap the heart icon on any store to save it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {favStores.map((store) => {
                const dist = distanceKm(userLocation?.[0] ?? null, userLocation?.[1] ?? null, store.latitude, store.longitude);
                return (
                  <div key={store.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-card booka-shadow-sm">
                    <button className="flex-1 flex items-center gap-3 text-left" onClick={() => onViewStore(store)}>
                      {store.avatar_url ? (
                        <img src={store.avatar_url} alt={store.name}
                          className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${store.is_open !== false ? "booka-gradient" : "bg-red-400"}`}>
                          {store.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{store.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs text-muted-foreground">
                            {store.review_count > 0 ? store.rating : "New"}
                          </span>
                          {dist && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <MapPin size={9} /> {dist}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => onToggleFav(store.id)}
                      className="p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all shrink-0"
                    >
                      <Heart size={16} className="text-red-500 fill-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          data-testid="button-sign-out"
          onClick={signOut}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left text-destructive transition-all active:scale-[0.98] mt-2"
        >
          <LogOut size={18} className="shrink-0" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>

    </div>
  );
};

// ── Main CustomerHome ─────────────────────────────────────────────────────────
interface Props { onSwitchToDashboard?: () => void; }

const CustomerHome = ({ onSwitchToDashboard }: Props) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ emoji: string; label: string } | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [bookingStore, setBookingStore] = useState<Store | null>(null);
  const [mapPinStore, setMapPinStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [favStoreIds, setFavStoreIds] = useState<Set<string>>(new Set());

  const [sheetExpanded, setSheetExpanded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const sheetTouchStartY = useRef(0);
  const sheetTouchDeltaY = useRef(0);

  const showMap = activeTab === "explore" && !selectedCategory && !selectedStore && !bookingStore;

  // ── Online/offline ────────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Fetch stores ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("stores")
      .select("id, name, description, address, phone, category, rating, review_count, latitude, longitude, is_open, buffer_minutes, accepting_bookings, commitment_fee, cancellation_hours, announcement, avatar_url")
      .then(({ data, error }) => {
        console.log("[Booka] stores response:", { data, error });
        if (data) setStores(data as Store[]);
      });
  }, []);

  // ── Fetch favourites ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("customer_favourites")
      .select("store_id")
      .eq("customer_id", user.id)
      .then(({ data }) => {
        if (data) setFavStoreIds(new Set(data.map((f) => f.store_id)));
      });
  }, [user]);

  // ── Toggle favourite ──────────────────────────────────────────────────────
  const toggleFav = useCallback(async (storeId: string) => {
    if (!user) { toast.error("Sign in to save favourites"); return; }
    const isFav = favStoreIds.has(storeId);
    if (isFav) {
      setFavStoreIds((prev) => { const n = new Set(prev); n.delete(storeId); return n; });
      await supabase.from("customer_favourites").delete()
        .eq("customer_id", user.id).eq("store_id", storeId);
    } else {
      setFavStoreIds((prev) => new Set([...prev, storeId]));
      await supabase.from("customer_favourites").insert({ customer_id: user.id, store_id: storeId });
    }
  }, [user, favStoreIds]);

  // ── Map markers ───────────────────────────────────────────────────────────
  const refreshMarkers = useCallback(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    Object.values(markersRef.current).forEach((m) => { try { map.removeLayer(m); } catch {} });
    markersRef.current = {};

    const displayed = filterCat ? stores.filter((s) => s.category === filterCat) : stores;

    displayed.forEach((store) => {
      const lat = store.latitude ?? DEFAULT_CENTER[0] + stableOffset(store.id, 0);
      const lng = store.longitude ?? DEFAULT_CENTER[1] + stableOffset(store.id, 1);
      const active = store.id === mapPinStore?.id;
      const closed = store.is_open === false;
      const emoji = getCategoryEmoji(store.category);
      const initials = store.name.slice(0, 2).toUpperCase();
      const html = `
        <div class="bwp${active ? " bwp--active" : ""}${closed ? " bwp--closed" : ""}">
          <div class="bwp-body">
            <span class="bwp-emoji">${emoji}</span>
            <span class="bwp-label">${initials}</span>
          </div>
          <div class="bwp-pointer"></div>
        </div>`;
      const icon = L.divIcon({ className: "", html, iconSize: [44, 58], iconAnchor: [22, 58] });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.on("click", () => setMapPinStore(store));
      markersRef.current[store.id] = marker;
    });
  }, [stores, filterCat, mapPinStore?.id]);

  // ── Map initialisation (once on mount) ───────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = window.L;
    if (!L) { console.error("[Booka] Leaflet not on window.L"); return; }

    const map = L.map(mapContainerRef.current, { center: DEFAULT_CENTER, zoom: 13, zoomControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        map.setView([coords.latitude, coords.longitude], 15);
        setUserLocation([coords.latitude, coords.longitude]);
        const dot = L.divIcon({
          className: "",
          html: '<div class="booka-user-dot"><div class="booka-user-ring"></div></div>',
          iconSize: [20, 20], iconAnchor: [10, 10],
        });
        L.marker([coords.latitude, coords.longitude], { icon: dot }).addTo(map);
      },
      () => {}
    );

    return () => { map.remove(); mapRef.current = null; markersRef.current = {}; };
  }, []);

  // Invalidate size when map becomes visible
  useEffect(() => {
    if (showMap && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    }
  }, [showMap]);

  useEffect(() => { refreshMarkers(); }, [refreshMarkers]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedStore(null);
    setBookingStore(null);
    setSelectedCategory(null);
    setMapPinStore(null);
  };

  const handleCategoryTap = (cat: { emoji: string; label: string }) => {
    setFilterCat(cat.label);
    setSelectedCategory(cat);
    setMapPinStore(null);
    setSheetExpanded(true);
  };

  const tabs: { id: Tab; label: string; icon: typeof MapPin }[] = [
    { id: "explore",  label: "Explore",  icon: MapPin },
    { id: "search",   label: "Search",   icon: Search },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "profile",  label: "Profile",  icon: User },
  ];

  const filteredForSheet = stores.filter((s) => s.category === filterCat);

  return (
    <div
      style={{
        maxWidth: 512, margin: "0 auto", height: "100dvh",
        overflow: "hidden", position: "relative", background: "hsl(var(--background))",
      }}
    >
      {/* ── Offline banner ─────────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="absolute inset-x-0 top-0 z-[700] bg-orange-500 text-white text-center py-2 text-xs font-semibold">
          No internet connection. Check your connection and try again.
        </div>
      )}

      {/* ── Map container (always mounted, visibility toggled) ──────────────── */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 56,
          visibility: showMap ? "visible" : "hidden",
          pointerEvents: showMap ? "auto" : "none",
        }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* ── Map pin popup card (compact) ───────────────────────────────────── */}
      {showMap && mapPinStore && (
        <div
          className="absolute left-1/2 booka-pin-popup"
          style={{
            bottom: `calc(${sheetExpanded ? "57%" : "90px"} + 80px)`,
            transform: "translateX(-50%)",
            zIndex: 450,
            maxWidth: 260,
            width: "calc(100% - 32px)",
          }}
        >
          <div className="bg-white rounded-2xl flex items-center gap-2.5 px-3 py-2.5 relative"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.15)" }}
          >
            {/* Avatar */}
            {mapPinStore.avatar_url ? (
              <img src={mapPinStore.avatar_url} alt={mapPinStore.name}
                className="w-8 h-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg booka-gradient flex items-center justify-center text-white font-bold text-[11px] shrink-0">
                {mapPinStore.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-[13px] truncate leading-tight">{mapPinStore.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-[11px] text-slate-500">
                  {mapPinStore.review_count > 0 ? mapPinStore.rating : "New"}
                </span>
                {mapPinStore.is_open === false && (
                  <span className="text-[9px] font-bold bg-red-500 text-white px-1 py-0.5 rounded-full ml-1">CLOSED</span>
                )}
              </div>
            </div>

            {/* View Profile button */}
            <button
              onClick={() => { setSelectedStore(mapPinStore); setMapPinStore(null); }}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#1d4ed8] text-white text-[11px] font-bold transition-all active:scale-95"
            >
              View
            </button>

            {/* Close */}
            <button
              onClick={() => setMapPinStore(null)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center active:scale-90 transition-all"
            >
              <X size={10} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom sheet (explore only) ────────────────────────────────────── */}
      {showMap && (
        <div
          className="absolute inset-x-0 bg-white rounded-t-3xl overflow-hidden"
          style={{
            bottom: 56,
            height: sheetExpanded ? "57%" : "90px",
            zIndex: 500,
            boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
            transition: "height 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          onTouchStart={(e) => { sheetTouchStartY.current = e.touches[0].clientY; sheetTouchDeltaY.current = 0; }}
          onTouchMove={(e) => { sheetTouchDeltaY.current = e.touches[0].clientY - sheetTouchStartY.current; }}
          onTouchEnd={() => {
            if (sheetTouchDeltaY.current < -40) setSheetExpanded(true);
            if (sheetTouchDeltaY.current > 40) setSheetExpanded(false);
          }}
        >
          {/* Drag handle */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-pointer"
            onClick={() => setSheetExpanded((v) => !v)}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>

          {/* Where to? search bar */}
          <div className="px-4 mb-3">
            {filterCat ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-[#1e2433] text-left">
                <Search size={15} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-slate-200 text-sm font-medium">
                  {CATEGORIES.find((c) => c.label === filterCat)?.emoji} {filterCat}
                </span>
                <button
                  onClick={() => { setFilterCat(null); setSheetExpanded(false); }}
                  className="text-xs text-slate-400 font-semibold hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => switchTab("search")}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-full bg-[#1e2433] text-left transition-all active:scale-[0.97]"
              >
                <Search size={15} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-slate-400 text-sm">Where to?</span>
                <Mic size={15} className="text-slate-400 shrink-0" />
              </button>
            )}
          </div>

          {/* ── Expanded content ────────────────────────────────────────────── */}
          {sheetExpanded && !filterCat && (
            <div className="fade-in">
              <div className="px-4 mb-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Browse Services</p>
              </div>
              <div className="px-4 grid grid-cols-4 gap-2.5 pb-4 overflow-y-auto">
                {CATEGORIES.map((cat, idx) => {
                  const palettes = [
                    "bg-violet-50 border-violet-100 hover:border-violet-300",
                    "bg-sky-50 border-sky-100 hover:border-sky-300",
                    "bg-rose-50 border-rose-100 hover:border-rose-300",
                    "bg-amber-50 border-amber-100 hover:border-amber-300",
                    "bg-emerald-50 border-emerald-100 hover:border-emerald-300",
                    "bg-indigo-50 border-indigo-100 hover:border-indigo-300",
                    "bg-pink-50 border-pink-100 hover:border-pink-300",
                    "bg-orange-50 border-orange-100 hover:border-orange-300",
                    "bg-teal-50 border-teal-100 hover:border-teal-300",
                    "bg-fuchsia-50 border-fuchsia-100 hover:border-fuchsia-300",
                    "bg-lime-50 border-lime-100 hover:border-lime-300",
                    "bg-cyan-50 border-cyan-100 hover:border-cyan-300",
                  ];
                  const palette = palettes[idx % palettes.length];
                  return (
                    <button
                      key={cat.label}
                      data-testid={`button-category-${cat.label}`}
                      onClick={() => handleCategoryTap(cat)}
                      className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all duration-150 active:scale-90 booka-shadow-sm ${palette}`}
                    >
                      <span className="text-3xl leading-none">{cat.emoji}</span>
                      <span className="text-[9px] font-bold text-foreground/80 text-center leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filtered store list when category filter active */}
          {sheetExpanded && filterCat && (
            <div className="px-4 pb-4 space-y-2 overflow-y-auto fade-in" style={{ maxHeight: "calc(57vh - 130px)" }}>
              <p className="text-xs text-muted-foreground mb-1">{filteredForSheet.length} nearby</p>
              {filteredForSheet.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No {filterCat} stores yet</p>
              ) : (
                filteredForSheet.map((store) => (
                  <div key={store.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
                    <button
                      className="flex-1 flex items-center gap-3 text-left"
                      onClick={() => setSelectedStore(store)}
                    >
                      {store.avatar_url ? (
                        <img src={store.avatar_url} alt={store.name}
                          className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${store.is_open !== false ? "booka-gradient" : "bg-red-400"}`}>
                          {store.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{store.name}</p>
                          {store.is_open === false && (
                            <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">CLOSED</span>
                          )}
                          {store.is_open !== false && store.accepting_bookings === false && (
                            <span className="text-[9px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded-full shrink-0">NO BOOKINGS</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          {store.review_count > 0 ? store.rating : "New"}
                        </p>
                      </div>
                      <ChevronRight size={15} className="text-muted-foreground shrink-0" />
                    </button>
                    <button
                      onClick={() => toggleFav(store.id)}
                      className="p-1.5 rounded-lg hover:bg-muted active:scale-95 shrink-0"
                    >
                      <Heart
                        size={14}
                        className={favStoreIds.has(store.id) ? "text-red-500" : "text-muted-foreground"}
                        fill={favStoreIds.has(store.id) ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Overlays ────────────────────────────────────────────────────────── */}
      {selectedCategory && !selectedStore && !bookingStore && (
        <CategoryResults
          category={selectedCategory}
          stores={stores}
          userLocation={userLocation}
          onBack={() => setSelectedCategory(null)}
          onSelect={(store) => setSelectedStore(store as Store)}
          favStoreIds={favStoreIds}
          onToggleFav={toggleFav}
        />
      )}

      {selectedStore && !bookingStore && (
        <StoreProfile
          store={selectedStore}
          userLocation={userLocation}
          onBack={() => setSelectedStore(null)}
          onBook={() => setBookingStore(selectedStore)}
          isFav={favStoreIds.has(selectedStore.id)}
          onToggleFav={() => toggleFav(selectedStore.id)}
        />
      )}

      {bookingStore && (
        <CustomerBooking store={bookingStore} onBack={() => setBookingStore(null)} />
      )}

      {/* ── Other tabs ──────────────────────────────────────────────────────── */}
      {activeTab === "search" && !selectedStore && !bookingStore && (
        <SearchScreen
          userLocation={userLocation}
          onSelectStore={(store) => setSelectedStore(store as Store)}
          favStoreIds={favStoreIds}
          onToggleFav={toggleFav}
        />
      )}

      {activeTab === "bookings" && !selectedStore && !bookingStore && (
        <CustomerReservations />
      )}

      {activeTab === "profile" && !selectedStore && !bookingStore && (
        <ProfileTab
          onSwitchToDashboard={onSwitchToDashboard}
          stores={stores}
          favStoreIds={favStoreIds}
          onToggleFav={toggleFav}
          userLocation={userLocation}
          onViewStore={(store) => { setSelectedStore(store); }}
        />
      )}

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <nav
        className="absolute inset-x-0 bottom-0 z-[600] bg-card/95 backdrop-blur-md border-t border-border"
        style={{ height: 56 }}
      >
        <div className="flex items-center justify-around h-full px-2">
          {tabs.map((t) => {
            const active = activeTab === t.id && !selectedStore && !bookingStore;
            return (
              <button
                key={t.id}
                data-testid={`tab-${t.id}`}
                onClick={() => switchTab(t.id)}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-95 ${
                  active ? "bg-primary/[0.08]" : "hover:bg-secondary"
                }`}
              >
                <t.icon
                  size={21}
                  strokeWidth={active ? 2.5 : 1.7}
                  color={active ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))"}
                />
                <span
                  className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}
                  style={{ color: active ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))" }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default CustomerHome;
