import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star, MapPin, Search, Calendar, User, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CustomerBooking from "@/components/CustomerBooking";
import CustomerReservations from "@/components/CustomerReservations";

interface Store {
  id: string;
  name: string;
  description: string;
  address: string;
  category: string;
  rating: number;
  review_count: number;
  image: string;
}

type Tab = "browse" | "bookings" | "profile";

const CustomerHome = () => {
  const { user, signOut } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  const [loadingStores, setLoadingStores] = useState(true);

  const displayName: string =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  useEffect(() => {
    supabase
      .from("stores")
      .select("*")
      .then(({ data, error }) => {
        if (!error && data) setStores(data as Store[]);
        setLoadingStores(false);
      });
  }, []);

  const filtered = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.category || "").toLowerCase().includes(search.toLowerCase())
  );

  if (selectedStore) {
    return <CustomerBooking store={selectedStore} onBack={() => setSelectedStore(null)} />;
  }

  const tabs: { id: Tab; label: string; icon: typeof MapPin }[] = [
    { id: "browse", label: "Browse", icon: Search },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background pb-20">
      {tab === "browse" && (
        <div className="px-5 pt-6">
          <div className="flex items-center justify-between mb-4 fade-in">
            <div>
              <p className="text-sm text-muted-foreground">Hello,</p>
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
            </div>
          </div>

          <div className="relative mb-6">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search stores or categories..."
              className="pl-10 rounded-xl h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loadingStores ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full h-20 rounded-2xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MapPin size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">{search ? "No stores match your search" : "No stores available yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((store, i) => (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card booka-shadow-sm transition-all duration-200 hover:booka-shadow active:scale-[0.98] slide-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
                >
                  <div className="w-12 h-12 rounded-xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                    {store.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{store.name}</p>
                    <p className="text-xs text-muted-foreground">{store.category || "Service"}</p>
                    {store.address ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {store.address}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 text-xs shrink-0">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    <span className="font-medium text-foreground">
                      {store.rating ? store.rating : "New"}
                    </span>
                    {store.review_count > 0 && (
                      <span className="text-muted-foreground">({store.review_count})</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bookings" && <CustomerReservations />}

      {tab === "profile" && (
        <div className="px-5 pt-6 space-y-4">
          <div className="flex items-center gap-4 fade-in">
            <div className="w-14 h-14 rounded-full booka-gradient flex items-center justify-center text-primary-foreground text-lg font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold">{displayName}</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full rounded-xl gap-2" onClick={signOut}>
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border booka-shadow-lg">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((t) => (
            <button
              key={t.id}
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
                style={{ color: tab === t.id ? "hsl(var(--booka-blue))" : "hsl(var(--booka-text-secondary))" }}
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
