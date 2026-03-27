import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  Search, Calendar, User, MapPin, ChevronRight, Star,
  X, Briefcase, Settings, HelpCircle, LogOut, Heart, Mic, Sun, Moon, CheckCircle2, CreditCard, Clock,
  Bell, Download, MessageSquare, Shield,
} from "lucide-react";
import { CATEGORIES, distanceKm, getCategoryEmoji } from "@/lib/categories";
import { type Store } from "@/components/StoreProfile";
import StoreProfile from "@/components/StoreProfile";
import SearchScreen from "@/components/SearchScreen";
import CustomerBooking from "@/components/CustomerBooking";
import CustomerReservations from "@/components/CustomerReservations";
import EditProfileScreen from "@/components/EditProfileScreen";
import { toast } from "sonner";
import {
  getPermission, requestPermission, showNotification,
  NOTIFICATION_PROMPT_KEY,
} from "@/lib/notifications";

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
  onSwitchToAdmin?: () => void;
  onEditProfile: () => void;
  stores: Store[];
  favStoreIds: Set<string>;
  onToggleFav: (id: string) => void;
  userLocation: [number, number] | null;
  onViewStore: (store: Store) => void;
  profileAvatarUrl: string | null;
  onAvatarSaved: (url: string | null) => void;
}

const ProfileTab = ({
  onSwitchToDashboard, onSwitchToAdmin, onEditProfile, stores, favStoreIds,
  onToggleFav, userLocation, onViewStore, profileAvatarUrl,
}: ProfileTabProps) => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [newBookingCount, setNewBookingCount] = useState(0);
  const [notifPermission, setNotifPermission] = useState(getPermission());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] || "Customer";

  const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const isInStandalone = (navigator as any).standalone === true;

  useEffect(() => {
    if (isIos && !isInStandalone) {
      const seen = localStorage.getItem("booka-ios-banner");
      if (!seen) setShowIosBanner(true);
    }
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
  const avatarUrl = profileAvatarUrl || profile?.avatar_url || null;

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    setNotifPermission(granted ? "granted" : "denied");
    if (granted) {
      toast.success("Notifications enabled!");
      localStorage.setItem(NOTIFICATION_PROMPT_KEY, "done");
    } else {
      toast.error("Notifications blocked. Enable them in your browser settings.");
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") { setDeferredPrompt(null); toast.success("Booka added to your home screen!"); }
    }
  };

  const favStores = stores.filter((s) => favStoreIds.has(s.id));

  return (
    <div className="absolute inset-x-0 top-0 overflow-y-auto bg-background fade-in" style={{ bottom: 56 }}>
      <div className="px-5 pt-8 pb-5 flex flex-col items-center border-b border-border">
        <button
          onClick={onEditProfile}
          className="relative group mb-3"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
              style={{ boxShadow: "0 0 0 4px hsl(213 82% 48% / 0.15)" }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full booka-gradient flex items-center justify-center text-primary-foreground text-2xl font-bold"
              style={{ boxShadow: "0 0 0 4px hsl(213 82% 48% / 0.15), 0 8px 24px -4px hsl(213 82% 48% / 0.3)" }}
            >
              {initials}
            </div>
          )}
          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-background">
            <User size={11} className="text-white" />
          </div>
        </button>
        <h1 className="text-lg font-bold text-foreground">{displayName}</h1>
        <p className="text-sm text-muted-foreground">{profile?.phone || user?.email}</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* iOS install banner */}
        {showIosBanner && (
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 relative">
            <button
              onClick={() => { setShowIosBanner(false); localStorage.setItem("booka-ios-banner", "1"); }}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3">
              <Download size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">Add Booka to Home Screen</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tap the <strong>Share</strong> button in Safari, then choose <strong>Add to Home Screen</strong> for the full app experience.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Android install button */}
        {deferredPrompt && (
          <button
            onClick={handleInstall}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 transition-all active:scale-[0.98]"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Download size={18} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Install Booka App</p>
              <p className="text-xs text-muted-foreground">Add to your home screen</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </button>
        )}

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

        {onSwitchToAdmin && (
          <button
            data-testid="button-switch-admin"
            onClick={onSwitchToAdmin}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/30 transition-all active:scale-[0.98]"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center shrink-0">
              <Shield size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Admin Dashboard</p>
              <p className="text-xs text-amber-600 dark:text-amber-400/70">Platform management</p>
            </div>
            <ChevronRight size={16} className="text-amber-500 shrink-0" />
          </button>
        )}

        {/* Edit Profile */}
        <button
          data-testid="button-edit-profile"
          onClick={onEditProfile}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left transition-all active:scale-[0.98] menu-item-animate"
        >
          <User size={18} className="text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm font-medium text-foreground">Edit Profile</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>

        {/* Notifications toggle */}
        {notifPermission !== "unsupported" && notifPermission !== "granted" && (
          <button
            data-testid="button-enable-notifications"
            onClick={handleEnableNotifications}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left transition-all active:scale-[0.98]"
          >
            <Bell size={18} className="text-muted-foreground shrink-0" />
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-foreground">Enable Notifications</span>
              <p className="text-xs text-muted-foreground">Get alerts for bookings and messages</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        )}

        {/* Settings / Help */}
        {[{ icon: Settings, label: "Settings" }, { icon: HelpCircle, label: "Help & Support" }].map((item, idx) => (
          <button
            key={item.label}
            onClick={() => toast.info("Coming soon!")}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left transition-all active:scale-[0.98] menu-item-animate"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <item.icon size={18} className="text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}

        {/* Dark mode toggle */}
        <button
          data-testid="button-toggle-theme"
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left transition-all active:scale-[0.98] menu-item-animate"
        >
          {theme === "dark" ? (
            <Sun size={18} className="text-amber-400 shrink-0" />
          ) : (
            <Moon size={18} className="text-slate-500 shrink-0" />
          )}
          <span className="flex-1 text-sm font-medium text-foreground">
            {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          </span>
          <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${theme === "dark" ? "bg-primary" : "bg-secondary border border-border"}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${theme === "dark" ? "left-[22px]" : "left-0.5"}`} />
          </div>
        </button>

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
interface Props {
  onSwitchToDashboard?: () => void;
  onSwitchToAdmin?: () => void;
}

const CustomerHome = ({ onSwitchToDashboard, onSwitchToAdmin }: Props) => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [bookingStore, setBookingStore] = useState<Store | null>(null);
  const [mapPinStore, setMapPinStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [favStoreIds, setFavStoreIds] = useState<Set<string>>(new Set());

  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [mapDark, setMapDark] = useState<boolean>(() => {
    try { return localStorage.getItem("booka-map-dark") !== "false"; } catch { return true; }
  });
  const [fygaroConfirmed, setFygaroConfirmed] = useState<{
    ref: string; storeName: string; date: string; startTime: string; endTime: string;
    serviceName?: string; serviceTotal?: number;
  } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const tileLayerRef = useRef<any>(null);
  const sheetTouchStartY = useRef(0);
  const sheetTouchDeltaY = useRef(0);

  const showMap = activeTab === "explore" && !selectedStore && !bookingStore;

  // ── Online/offline ────────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Sync profile avatar from DB ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setProfileAvatarUrl(data.avatar_url); });
  }, [user]);

  // ── Unread message count for bookings badge ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { data: resData } = await supabase
        .from("reservations").select("id").eq("customer_id", user.id);
      if (!resData || resData.length === 0) { setUnreadMsgCount(0); return; }
      const resIds = resData.map((r) => r.id);
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .in("reservation_id", resIds)
        .eq("sender_role", "store")
        .eq("read", false);
      setUnreadMsgCount(count ?? 0);
    };
    fetchUnread();
    const channel = supabase
      .channel(`unread-msgs-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "messages" }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Fygaro payment return handler ─────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customRef = params.get("customReference");
    const fygaroRef = params.get("reference");
    if (!customRef || !fygaroRef) return;

    // Clear the URL params without reload
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    // Read pending booking from localStorage
    let pending: any = null;
    try { pending = JSON.parse(localStorage.getItem("booka_pending_payment") ?? "null"); } catch {}

    const reservationId = customRef;

    // Mark payment as paid in DB
    supabase
      .from("reservations")
      .update({ payment_status: "paid" })
      .eq("id", reservationId)
      .then(({ error }) => {
        if (error) { toast.error("Payment recorded but couldn't update status. Contact support."); return; }
        try { localStorage.removeItem("booka_pending_payment"); } catch {}
        if (pending && pending.reservationId === reservationId) {
          setFygaroConfirmed({
            ref: pending.ref,
            storeName: pending.storeName,
            date: pending.date,
            startTime: pending.startTime,
            endTime: pending.endTime,
            serviceName: pending.serviceName,
            serviceTotal: pending.serviceTotal,
          });
        } else {
          toast.success("Payment confirmed! Your booking is secured.");
        }
      });
  }, []);

  // ── Fetch stores ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("stores")
      .select("id, name, description, address, phone, category, categories, rating, review_count, latitude, longitude, is_open, buffer_minutes, accepting_bookings, cancellation_hours, announcement, avatar_url")
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

    const displayed = filterCat
      ? stores.filter((s) => (s.categories && s.categories.length > 0 ? s.categories : [s.category]).includes(filterCat))
      : stores;

    displayed.forEach((store) => {
      const lat = store.latitude ?? DEFAULT_CENTER[0] + stableOffset(store.id, 0);
      const lng = store.longitude ?? DEFAULT_CENTER[1] + stableOffset(store.id, 1);
      const active = store.id === mapPinStore?.id;
      const closed = store.is_open === false;
      const primaryCat = (store.categories && store.categories.length > 0) ? store.categories[0] : store.category;
      const emoji = getCategoryEmoji(primaryCat);
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

    const initialDark = (() => { try { return localStorage.getItem("booka-map-dark") !== "false"; } catch { return true; } })();
    const tileUrl = initialDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const map = L.map(mapContainerRef.current, { center: DEFAULT_CENTER, zoom: 11, zoomControl: false });
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20,
    }).addTo(map);

    // Apply brightness filter to tile pane
    const applyTileFilter = (dark: boolean) => {
      const pane = map.getPane("tilePane") as HTMLElement | undefined;
      if (pane) pane.style.filter = dark ? "brightness(1.2) contrast(0.9)" : "none";
    };
    applyTileFilter(initialDark);
    (map as any)._bookaApplyTileFilter = applyTileFilter;

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        map.setView([coords.latitude, coords.longitude], 11);
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

  // ── Map dark/light toggle ─────────────────────────────────────────────────
  const toggleMapStyle = useCallback(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;
    const next = !mapDark;
    const tileUrl = next
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    if (tileLayerRef.current) { try { map.removeLayer(tileLayerRef.current); } catch {} }
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: "© OpenStreetMap contributors © CARTO", maxZoom: 20,
    }).addTo(map);
    (map as any)._bookaApplyTileFilter?.(next);
    setMapDark(next);
    try { localStorage.setItem("booka-map-dark", String(next)); } catch {}
  }, [mapDark]);

  // ── Map zoom helpers ──────────────────────────────────────────────────────
  const zoomToUserAndStore = useCallback((store: Store) => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;
    const storeLat = store.latitude ?? DEFAULT_CENTER[0] + stableOffset(store.id, 0);
    const storeLng = store.longitude ?? DEFAULT_CENTER[1] + stableOffset(store.id, 1);
    const points: [number, number][] = [[storeLat, storeLng]];
    if (userLocation) points.push(userLocation);
    const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15, animate: true });
  }, [userLocation]);

  const resetMapZoom = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = userLocation ?? DEFAULT_CENTER;
    map.setView(center, 11, { animate: true });
  }, [userLocation]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedStore(null);
    setBookingStore(null);
    setFilterCat(null);
    setMapPinStore(null);
    resetMapZoom();
  };

  const handleCategoryTap = (cat: { emoji: string; label: string }) => {
    setMapPinStore(null);
    setSheetExpanded(false);

    const filtered = stores.filter((s) =>
      (s.categories && s.categories.length > 0 ? s.categories : [s.category]).includes(cat.label)
    );

    setFilterCat(cat.label);

    if (filtered.length === 0) return;

    // Find closest store to user
    const closest = userLocation
      ? filtered.reduce((best, s) => {
          const d1 = Math.hypot(
            (s.latitude ?? DEFAULT_CENTER[0]) - userLocation[0],
            (s.longitude ?? DEFAULT_CENTER[1]) - userLocation[1]
          );
          const d2 = Math.hypot(
            (best.latitude ?? DEFAULT_CENTER[0]) - userLocation[0],
            (best.longitude ?? DEFAULT_CENTER[1]) - userLocation[1]
          );
          return d1 < d2 ? s : best;
        })
      : filtered[0];

    // Small delay to let markers refresh before fitting bounds
    setTimeout(() => zoomToUserAndStore(closest), 80);
  };

  const tabs: { id: Tab; label: string; icon: typeof MapPin }[] = [
    { id: "explore",  label: "Explore",  icon: MapPin },
    { id: "search",   label: "Search",   icon: Search },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "profile",  label: "Profile",  icon: User },
  ];

  const filteredForSheet = stores.filter((s) =>
    filterCat ? (s.categories && s.categories.length > 0 ? s.categories : [s.category]).includes(filterCat) : true
  );

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

        {/* Dark/light map toggle button */}
        {showMap && (
          <button
            data-testid="button-map-style-toggle"
            onClick={toggleMapStyle}
            className="absolute top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 z-[600]"
            style={{
              background: mapDark ? "#ffffff" : "#1e2433",
              boxShadow: "0 2px 12px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.15)",
            }}
            title={mapDark ? "Switch to light map" : "Switch to dark map"}
          >
            {mapDark
              ? <Sun size={18} className="text-slate-700" />
              : <Moon size={18} className="text-white" />
            }
          </button>
        )}
      </div>

      {/* ── Map pin popup card (compact) ───────────────────────────────────── */}
      {showMap && mapPinStore && (
        <div
          className="absolute left-1/2 booka-pin-popup"
          style={{
            bottom: `calc(${filterCat ? "30%" : sheetExpanded ? "57%" : "90px"} + 80px)`,
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
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-[11px] text-slate-500">
                  {mapPinStore.review_count > 0 ? mapPinStore.rating : "New"}
                </span>
                {(() => {
                  const d = distanceKm(userLocation?.[0] ?? null, userLocation?.[1] ?? null, mapPinStore.latitude, mapPinStore.longitude);
                  return d ? <span className="text-[11px] text-slate-400 flex items-center gap-0.5"><MapPin size={9} />{d}</span> : null;
                })()}
                {mapPinStore.is_open === false && (
                  <span className="text-[9px] font-bold bg-red-500 text-white px-1 py-0.5 rounded-full">CLOSED</span>
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
            height: filterCat ? "30%" : sheetExpanded ? "57%" : "90px",
            zIndex: 500,
            boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
            transition: "height 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          onTouchStart={(e) => { sheetTouchStartY.current = e.touches[0].clientY; sheetTouchDeltaY.current = 0; }}
          onTouchMove={(e) => { sheetTouchDeltaY.current = e.touches[0].clientY - sheetTouchStartY.current; }}
          onTouchEnd={() => {
            if (filterCat) return; // lock at 30% when category active
            if (sheetTouchDeltaY.current < -40) setSheetExpanded(true);
            if (sheetTouchDeltaY.current > 40) setSheetExpanded(false);
          }}
        >
          {/* Drag handle — only toggles when no category filter */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-pointer"
            onClick={() => { if (!filterCat) setSheetExpanded((v) => !v); }}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>

          {/* Where to? / category search bar */}
          <div className="px-4 mb-2">
            {filterCat ? (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1e2433] text-left">
                <Search size={15} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-slate-200 text-sm font-medium">
                  {CATEGORIES.find((c) => c.label === filterCat)?.emoji} {filterCat}
                </span>
                <button
                  onClick={() => {
                    setFilterCat(null);
                    setSheetExpanded(false);
                    setMapPinStore(null);
                    resetMapZoom();
                  }}
                  className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center hover:bg-slate-500 active:scale-90 transition-all shrink-0"
                >
                  <X size={11} className="text-white" />
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
                      <span className="text-[9px] font-bold text-slate-700 text-center leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category results — always visible at 30% when filterCat active */}
          {filterCat && (
            <div className="flex flex-col" style={{ height: "calc(100% - 90px)", overflow: "hidden" }}>
              <p className="text-xs font-medium text-slate-400 px-4 mb-1.5">
                {filteredForSheet.length} {filteredForSheet.length === 1 ? "store" : "stores"} nearby
              </p>
              <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2 fade-in">
                {filteredForSheet.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No stores found in this category</p>
                ) : (
                  filteredForSheet.map((store) => {
                    const dist = distanceKm(userLocation?.[0] ?? null, userLocation?.[1] ?? null, store.latitude, store.longitude);
                    return (
                      <div key={store.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-100">
                        <button
                          className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                          onClick={() => {
                            setMapPinStore(store);
                            zoomToUserAndStore(store);
                          }}
                        >
                          {store.avatar_url ? (
                            <img src={store.avatar_url} alt={store.name}
                              className="w-10 h-10 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl booka-gradient flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {store.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{store.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                <Star size={9} className="text-amber-400 fill-amber-400" />
                                {store.review_count > 0 ? store.rating : "New"}
                              </span>
                              {dist && (
                                <span className="text-xs text-slate-400 flex items-center gap-0.5">
                                  <MapPin size={9} /> {dist}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => toggleFav(store.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 active:scale-95 shrink-0 transition-all"
                        >
                          <Heart
                            size={15}
                            className={favStoreIds.has(store.id) ? "text-red-500" : "text-slate-300"}
                            fill={favStoreIds.has(store.id) ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Overlays ────────────────────────────────────────────────────────── */}
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

      {/* ── Fygaro payment confirmed overlay ────────────────────────────────── */}
      {fygaroConfirmed && (
        <div className="fixed inset-0 z-[500] bg-background flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-xs text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto bounce-in">
              <CheckCircle2 size={42} className="text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Payment Confirmed!</h1>
              <p className="text-sm text-muted-foreground mt-1">Your booking is secured.</p>
            </div>
            <div className="p-5 rounded-2xl bg-card booka-shadow text-left space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Store</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{fygaroConfirmed.storeName}</p>
              </div>
              {fygaroConfirmed.serviceName && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Service</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{fygaroConfirmed.serviceName}</p>
                  {fygaroConfirmed.serviceTotal !== undefined && (
                    <p className="text-xs font-bold mt-0.5" style={{ color: "hsl(var(--booka-blue))" }}>
                      J${fygaroConfirmed.serviceTotal.toFixed(0)}
                    </p>
                  )}
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</p>
                <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                  <Calendar size={13} style={{ color: "hsl(var(--booka-blue))" }} /> {fygaroConfirmed.date}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Time</p>
                <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                  <Clock size={13} style={{ color: "hsl(var(--booka-blue))" }} /> {fygaroConfirmed.startTime} – {fygaroConfirmed.endTime}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Paid via</p>
                <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                  <CreditCard size={13} style={{ color: "hsl(var(--booka-blue))" }} /> Fygaro
                </p>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Booking Reference</p>
                <p className="text-xl font-bold font-mono tracking-widest mt-0.5" style={{ color: "hsl(var(--booka-blue))" }}>
                  #{fygaroConfirmed.ref}
                </p>
              </div>
            </div>
            <button
              data-testid="button-fygaro-confirmed-done"
              className="w-full h-12 rounded-xl font-semibold text-white"
              style={{ background: "linear-gradient(135deg, hsl(var(--booka-blue)) 0%, hsl(220 85% 16%) 100%)" }}
              onClick={() => { setFygaroConfirmed(null); setActiveTab("bookings"); }}
            >
              View My Bookings
            </button>
          </div>
        </div>
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
        <CustomerReservations onUnreadChange={setUnreadMsgCount} />
      )}

      {activeTab === "profile" && !selectedStore && !bookingStore && (
        <ProfileTab
          onSwitchToDashboard={onSwitchToDashboard}
          onSwitchToAdmin={onSwitchToAdmin}
          onEditProfile={() => setShowEditProfile(true)}
          stores={stores}
          favStoreIds={favStoreIds}
          onToggleFav={toggleFav}
          userLocation={userLocation}
          onViewStore={(store) => { setSelectedStore(store); }}
          profileAvatarUrl={profileAvatarUrl}
          onAvatarSaved={(url) => setProfileAvatarUrl(url)}
        />
      )}

      {/* ── Edit Profile overlay ─────────────────────────────────────────────── */}
      {showEditProfile && (
        <EditProfileScreen
          onBack={() => setShowEditProfile(false)}
          onSaved={(name, phone, url) => {
            setProfileAvatarUrl(url);
          }}
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
            const badge = t.id === "bookings" && unreadMsgCount > 0 ? unreadMsgCount : 0;
            return (
              <button
                key={t.id}
                data-testid={`tab-${t.id}`}
                onClick={() => switchTab(t.id)}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-95 ${
                  active ? "bg-primary/[0.08]" : "hover:bg-secondary"
                }`}
              >
                <div className="relative">
                  <t.icon
                    size={21}
                    strokeWidth={active ? 2.5 : 1.7}
                    color={active ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))"}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
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
