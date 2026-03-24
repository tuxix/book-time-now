import { ArrowLeft, Star, MapPin } from "lucide-react";
import { distanceKm } from "@/lib/categories";
import { type Store } from "@/components/StoreProfile";

interface Props {
  category: { emoji: string; label: string };
  stores: Store[];
  userLocation: [number, number] | null;
  onBack: () => void;
  onSelect: (store: Store) => void;
}

const CategoryResults = ({ category, stores, userLocation, onBack, onSelect }: Props) => {
  const raw = stores.filter((s) => s.category === category.label);
  const filtered = [
    ...raw.filter((s) => s.is_open !== false),
    ...raw.filter((s) => s.is_open === false),
  ];

  return (
    <div className="absolute inset-x-0 top-0 overflow-y-auto bg-background fade-in" style={{ bottom: 56, zIndex: 300 }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} data-testid="button-back-category"
          className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-foreground">{category.emoji} {category.label}</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} nearby</p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-5xl mb-4">{category.emoji}</p>
            <p className="text-sm font-medium">No {category.label} stores available yet</p>
            <p className="text-xs mt-1 opacity-70">Check back soon!</p>
          </div>
        ) : (
          filtered.map((store) => {
            const dist = distanceKm(
              userLocation?.[0] ?? null, userLocation?.[1] ?? null,
              store.latitude, store.longitude
            );
            return (
              <button
                key={store.id}
                data-testid={`card-category-store-${store.id}`}
                onClick={() => onSelect(store)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card booka-shadow-sm text-left transition-all active:scale-[0.98]"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${store.is_open !== false ? "booka-gradient" : "bg-red-400"}`}>
                  {store.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">{store.name}</p>
                    {store.is_open === false && (
                      <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">CLOSED</span>
                    )}
                    {store.is_open !== false && store.accepting_bookings === false && (
                      <span className="text-[10px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded-full">NO BOOKINGS</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <div className="flex items-center gap-0.5">
                      <Star size={11} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs text-muted-foreground">
                        {store.review_count > 0 ? store.rating : "New"}
                      </span>
                    </div>
                    {dist && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <MapPin size={10} /> {dist}
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CategoryResults;
