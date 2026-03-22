import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const RoleSelectPage = () => {
  const { user, refreshProfile } = useAuth();
  const [role, setRole] = useState<"customer" | "store">("customer");
  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      // Save name to auth metadata
      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), role },
      });
      if (metaError) throw metaError;

      // Create profile row — trigger may have already created it; ON CONFLICT DO NOTHING
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: user.id, role });
      if (profileError && profileError.code !== "23505") throw profileError;

      // Create store record if store role
      if (role === "store") {
        const { error: storeError } = await supabase
          .from("stores")
          .insert({ user_id: user.id, name: fullName.trim() });
        if (storeError && storeError.code !== "23505") throw storeError;
      }

      // Refresh profile in auth context so routing updates without a full page reload
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2 fade-in">
          <h1 className="text-2xl font-bold text-foreground">Almost there!</h1>
          <p className="text-sm text-muted-foreground">
            Choose how you'll use Booka
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 slide-up">
          <Input
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`flex-1 py-4 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
                role === "customer"
                  ? "bg-primary text-primary-foreground booka-shadow"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              🧑 Customer
              <p className="text-xs font-normal mt-1 opacity-80">
                Browse & book services
              </p>
            </button>
            <button
              type="button"
              onClick={() => setRole("store")}
              className={`flex-1 py-4 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
                role === "store"
                  ? "bg-primary text-primary-foreground booka-shadow"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              🏪 Store
              <p className="text-xs font-normal mt-1 opacity-80">
                Manage your business
              </p>
            </button>
          </div>
          <Button
            type="submit"
            className="w-full h-12 rounded-xl font-semibold"
            disabled={loading || !fullName.trim()}
          >
            {loading ? "Setting up..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default RoleSelectPage;
