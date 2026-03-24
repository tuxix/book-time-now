import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Clock, Star, MapPin, X } from "lucide-react";
import { getCategoryEmoji, distanceKm } from "@/lib/categories";
import { type Store } from "@/components/StoreProfile";

interface Props {
  userLocation: [number, number] | null;
  onSelectStore: (store: Store) => void;
}

const RECENT_KEY = "booka_recent_searches";
const getRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};
const addRecent = (q: string) => {
  const items = getRecent().filter((s) => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...items].slice(0, 6)));
};

const SearchScreen = ({ userLocation, onSelectStore }: Props) => {
  const [query, setQuery] = useState("");
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecent());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("stores")
      .select("id, name, description, address, phone, category, rating, review_count, latitude, longitude")
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

  const StoreCard = ({ store }: { store: Store }) => {
    const dist = distanceKm(userLocation?.[0] ?? null, userLocation?.[1] ?? null, store.latitude, store.longitude);
    return (
      <button
        data-testid={`card-search-store-${store.id}`}
        onClick={() => handleSelect(store)}
        className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left transition-all active:scale-[0.98]"
      >
        <div className="w-11 h-11 rounded-xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
          {store.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{store.name}</p>
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
    );
  };

  return (
    <div className="absolute inset-x-0 top-0 bg-background" style={{ bottom: 56, zIndex: 200, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Search bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2 bg-secondary rounded-2xl px-3">
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-3">
        {/* Recent searches */}
        {!query && recentSearches.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent</p>
            {recentSearches.map((s) => (
              <button key={s} onClick={() => setQuery(s)}
                className="flex items-center gap-3 w-full py-2.5 text-sm text-foreground transition-all hover:text-primary">
                <Clock size={14} className="text-muted-foreground shrink-0" />
                {s}
              </button>
            ))}
            <div className="h-px bg-border my-3" />
          </div>
        )}

        {!query && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">All Stores</p>
        )}

        {query && results.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No results for "{query}"</p>
          </div>
        ) : (
          results.map((store) => <StoreCard key={store.id} store={store} />)
        )}
      </div>
    </div>
  );
};

export default SearchScreen;
