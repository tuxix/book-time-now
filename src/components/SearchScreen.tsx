import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Clock, Star, MapPin, X, Heart } from "lucide-react";
import { getCategoryEmoji, distanceKm } from "@/lib/categories";
import { type Store } from "@/components/StoreProfile";

interface Props {
  userLocation: [number, number] | null;
  onSelectStore: (store: Store) => void;
  favStoreIds?: Set<string>;
  onToggleFav?: (id: string) => void;
}

const RECENT_KEY = "booka_recent_searches";
const getRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};
const addRecent = (q: string) => {
  const items = getRecent().filter((s) => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...items].slice(0, 6)));
};
const removeRecent = (q: string) => {
  const items = getRecent().filter((s) => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify(items));
};

const SearchScreen = ({ userLocation, onSelectStore, favStoreIds, onToggleFav }: Props) => {
  const [query, setQuery] = useState("");
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecent());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("stores")
      .select("id, name, description, address, phone, category, rating, review_count, latitude, longitude, is_open, buffer_minutes, accepting_bookings, commitment_fee, cancellation_hours, announcement, avatar_url")
      .then(({ data }) => { if (data) setAllStores(data as Store[]); });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const results = query.trim()
    ? allStores.filter((s) => {
        const q = query.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q);
      })
    : allStores;

  const handleSelect = (store: Store) => {
    addRecent(store.name);
    setRecentSearches(getRecent());
    onSelectStore(store);
  };

  const handleRemoveRecent = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecent(item);
    setRecentSearches(getRecent());
  };

  const StoreCard = ({ store, index }: { store: Store; index: number }) => {
    const dist = distanceKm(userLocation?.[0] ?? null, userLocation?.[1] ?? null, store.latitude, store.longitude);
    const isFav = favStoreIds?.has(store.id) ?? false;
    return (
      <div
        className="flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm card-stagger"
        style={{ animationDelay: `${index * 45}ms` }}
      >
        <button
          data-testid={`card-search-store-${store.id}`}
          onClick={() => handleSelect(store)}
          className="flex-1 flex items-center gap-3 text-left"
        >
          {store.avatar_url ? (
            <img src={store.avatar_url} alt={store.name}
              className="w-12 h-12 rounded-xl object-cover shrink-0" />
          ) : (
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${store.is_open !== false ? "booka-gradient" : "bg-red-400"}`}>
              {store.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-foreground text-sm truncate">{store.name}</p>
              {store.is_open === false && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">CLOSED</span>
              )}
              {store.is_open !== false && store.accepting_bookings === false && (
                <span className="text-[10px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded-full shrink-0">NO BOOKINGS</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">{getCategoryEmoji(store.category)} {store.category}</span>
              <div className="flex items-center gap-0.5">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-xs text-muted-foreground">{store.review_count > 0 ? store.rating : "New"}</span>
              </div>
              {dist && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <MapPin size={10} /> {dist}
                </span>
              )}
            </div>
          </div>
        </button>
        {onToggleFav && (
          <button
            data-testid={`button-fav-search-${store.id}`}
            onClick={() => onToggleFav(store.id)}
            className="p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all shrink-0"
          >
            <Heart
              size={16}
              className={isFav ? "text-red-500" : "text-muted-foreground"}
              fill={isFav ? "currentColor" : "none"}
            />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-x-0 top-0 bg-background" style={{ bottom: 56, zIndex: 200, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Search bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="flex items-center gap-2 bg-secondary rounded-2xl px-3 booka-shadow-sm transition-shadow focus-within:booka-shadow-blue">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            data-testid="input-search-query"
            placeholder="Search stores or services…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-1 rounded-full hover:bg-muted active:scale-95">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-2.5">
        {/* Recent searches */}
        {!query && recentSearches.length > 0 && (
          <div className="mb-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Recent Searches</p>
            <div className="space-y-0.5">
              {recentSearches.map((s) => (
                <div key={s} className="flex items-center gap-2 group">
                  <button
                    onClick={() => setQuery(s)}
                    className="flex items-center gap-3 flex-1 py-2.5 text-sm text-foreground transition-all hover:text-primary active:scale-[0.98] text-left"
                  >
                    <Clock size={14} className="text-muted-foreground shrink-0" />
                    {s}
                  </button>
                  <button
                    data-testid={`button-remove-recent-${s}`}
                    onClick={(e) => handleRemoveRecent(s, e)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-secondary active:scale-95 transition-all"
                  >
                    <X size={12} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <div className="h-px bg-border my-3" />
          </div>
        )}

        {!query && (
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">All Stores</p>
        )}

        {query && results.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground fade-in">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Search size={26} className="opacity-30" />
            </div>
            <p className="text-sm font-semibold text-foreground">No results found</p>
            <p className="text-xs mt-1 opacity-70">for "{query}"</p>
            <p className="text-xs mt-3 opacity-50">Try a different store name or category</p>
          </div>
        ) : (
          results.map((store, i) => <StoreCard key={store.id} store={store} index={i} />)
        )}
      </div>
    </div>
  );
};

export default SearchScreen;
