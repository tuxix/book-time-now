import { ArrowLeft, Star, MapPin } from "lucide-react";
import { providers, categories, type ServiceProvider } from "@/data/mockData";

interface ProviderListProps {
  categoryId: string;
  onBack: () => void;
  onSelect: (provider: ServiceProvider) => void;
}

const ProviderList = ({ categoryId, onBack, onSelect }: ProviderListProps) => {
  const category = categories.find((c) => c.id === categoryId);
  const filtered = providers.filter((p) => p.category === categoryId);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl transition-all duration-200 hover:bg-secondary active:scale-95">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold leading-tight">{category?.label || "Providers"}</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} nearby</p>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {filtered.map((provider, i) => (
          <button
            key={provider.id}
            onClick={() => onSelect(provider)}
            className="w-full flex items-center gap-4 p-4 bg-card rounded-2xl booka-shadow-sm transition-all duration-200 hover:booka-shadow active:scale-[0.98] slide-up text-left"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <div className="w-14 h-14 rounded-2xl booka-gradient flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
              {provider.image}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[15px] truncate">{provider.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <Star size={13} className="text-booka-warning fill-booka-warning" />
                  <span className="text-xs font-medium">{provider.rating}</span>
                </div>
                <span className="text-muted-foreground text-[10px]">•</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin size={12} />
                  <span className="text-xs">{provider.distance}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProviderList;
