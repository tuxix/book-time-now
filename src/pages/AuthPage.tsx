import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import bookaLogo from "@/assets/booka-logo.png";

declare global { interface Window { L: any; } }

type Mode = "login" | "signup";

const DEFAULT_CENTER: [number, number] = [17.9970, -76.7936];

function stableOffset(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i);
  return ((h >>> 0) / 0xffffffff - 0.5) * 0.04;
}

const AuthPage = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"customer" | "store">("customer");
  const [loading, setLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const openSheet = (m: Mode) => {
    setMode(m);
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    setSheetOpen(true);
  };

  useEffect(() => {
    const L = window.L;
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapInstanceRef.current = map;

    supabase
      .from("stores")
      .select("id, name, latitude, longitude, is_open, avatar_url")
      .then(({ data }) => {
        if (!data || !mapInstanceRef.current) return;
        data.forEach((store, idx) => {
          const lat = store.latitude ?? DEFAULT_CENTER[0] + stableOffset(store.id, 0);
          const lng = store.longitude ?? DEFAULT_CENTER[1] + stableOffset(store.id, 1);
          const inner = store.avatar_url
            ? `<img src="${store.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="" />`
            : `<span>${store.name.slice(0, 2).toUpperCase()}</span>`;
          const html = `<div class="booka-pin pin-drop${store.is_open === false ? " booka-pin--closed" : ""}" style="animation-delay:${idx * 80}ms">${inner}</div>`;
          const icon = L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 18] });
          L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
        });
      });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          toast.error("Please enter your full name.");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim(), role } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").upsert({ id: data.user.id, role, full_name: fullName.trim(), phone: phone.trim() || null }, { onConflict: "id" }).then(() => {});
          if (role === "store") {
            await supabase.from("stores").insert({ user_id: data.user.id, name: fullName.trim() }).then(() => {});
          }
        }
        toast.success("Account created! Check your email to verify and then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("invalid login") || error.message.toLowerCase().includes("invalid credentials")) {
            throw new Error("Incorrect email or password. Please try again.");
          }
          throw error;
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0a1628" }}>
      {/* Map background */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Top dark gradient overlay */}
      <div
        className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        style={{ height: "45%", background: "linear-gradient(to bottom, rgba(4,12,30,0.85) 0%, rgba(4,12,30,0.3) 60%, transparent 100%)" }}
      />

      {/* Bottom dark gradient overlay */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{ height: "55%", background: "linear-gradient(to top, rgba(4,12,30,0.97) 55%, rgba(4,12,30,0.6) 80%, transparent 100%)" }}
      />

      {/* Logo + tagline at top */}
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center pt-16 px-6 fade-in">
        <div className="w-18 h-18 rounded-2xl booka-gradient flex items-center justify-center booka-shadow-blue mb-3" style={{ width: 72, height: 72 }}>
          <img src={bookaLogo} alt="Booka" className="w-14 h-14 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
        </div>
        <h1
          className="text-4xl font-black text-white tracking-tight"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)", letterSpacing: "-0.02em" }}
        >
          BOOKA
        </h1>
        <p
          className="text-white/70 text-sm font-medium mt-2 text-center max-w-xs"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
        >
          Find and book local services near you
        </p>
      </div>

      {/* Bottom CTA section */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-10">
        <div className="max-w-sm mx-auto slide-up">
          {/* Tagline / headline */}
          <div className="text-center mb-6">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Jamaica's Booking App</p>
            <p className="text-white text-2xl font-bold leading-snug">
              Your next appointment<br />is one tap away
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              data-testid="button-get-started"
              onClick={() => openSheet("signup")}
              className="w-full h-14 rounded-2xl text-white text-base font-bold active:scale-[0.97] transition-all booka-cta-pulse"
              style={{ background: "linear-gradient(135deg, hsl(213 82% 48%), hsl(220 85% 38%))" }}
            >
              Get Started
            </button>
            <button
              data-testid="button-sign-in-landing"
              onClick={() => openSheet("login")}
              className="w-full h-14 rounded-2xl text-white text-base font-semibold active:scale-[0.97] transition-all border border-white/20"
              style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* Bottom sheet (form) */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-30 fade-in"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0 z-40 bg-card rounded-t-3xl shadow-2xl slide-up overflow-y-auto" style={{ maxHeight: "92vh" }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
            </div>

            <div className="px-6 pb-10 pt-2">
              {/* Header */}
              <div className="flex flex-col items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 text-center">
                  {mode === "login" ? "Sign in to continue to Booka" : "Choose your role to get started"}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {mode === "signup" && (
                  <>
                    <Input
                      data-testid="input-full-name"
                      placeholder="Full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-12 rounded-xl"
                    />
                    <Input
                      data-testid="input-phone"
                      type="tel"
                      placeholder="Phone number (so stores can reach you)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-12 rounded-xl"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRole("customer")}
                        className={`flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${role === "customer" ? "bg-primary text-primary-foreground booka-shadow" : "bg-secondary text-secondary-foreground"}`}
                      >
                        🧑 Customer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("store")}
                        className={`flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${role === "store" ? "bg-primary text-primary-foreground booka-shadow" : "bg-secondary text-secondary-foreground"}`}
                      >
                        🏪 Store
                      </button>
                    </div>
                  </>
                )}

                <Input
                  data-testid="input-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                />
                <Input
                  data-testid="input-password"
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 rounded-xl"
                />
                <Button
                  data-testid="button-submit-auth"
                  type="submit"
                  className="w-full h-12 rounded-xl font-semibold booka-gradient booka-shadow-blue text-white border-0"
                  disabled={loading}
                >
                  {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Google */}
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl font-medium gap-2"
                onClick={handleGoogleLogin}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>

              {/* Switch mode */}
              <p className="text-center text-sm text-muted-foreground mt-4">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-primary font-semibold hover:underline"
                >
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuthPage;
