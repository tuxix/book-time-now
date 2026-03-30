import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import bookaLogo from "@/assets/booka-logo.png";

declare global { interface Window { L: any; } }
type Mode = "login" | "signup" | "forgot";
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
  const [forgotSent, setForgotSent] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const openSheet = (m: Mode) => {
    setMode(m); setEmail(""); setPassword(""); setFullName(""); setPhone(""); setForgotSent(false); setSheetOpen(true);
  };

  useEffect(() => {
    const L = window.L;
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER, zoom: 13, zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapInstanceRef.current = map;
    supabase.from("stores").select("id, name, latitude, longitude, is_open, avatar_url").then(({ data }) => {
      if (!data || !mapInstanceRef.current) return;
      data.forEach((store, idx) => {
        const lat = store.latitude ?? DEFAULT_CENTER[0] + stableOffset(store.id, 0);
        const lng = store.longitude ?? DEFAULT_CENTER[1] + stableOffset(store.id, 1);
        const inner = store.avatar_url
          ? '<img src="' + store.avatar_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="" />'
          : '<span>' + store.name.slice(0, 2).toUpperCase() + '</span>';
        const closedClass = store.is_open === false ? " booka-pin--closed" : "";
        const html = '<div class="booka-pin pin-drop' + closedClass + '" style="animation-delay:' + (idx * 80) + 'ms">' + inner + '</div>';
        const icon = L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 18] });
        L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      });
    });
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) { toast.error("Please enter your full name."); setLoading(false); return; }
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim(), role } } });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").upsert({ id: data.user.id, role, full_name: fullName.trim(), phone: phone.trim() || null }, { onConflict: "id" });
          if (role === "store") await supabase.from("stores").insert({ user_id: data.user.id, name: fullName.trim() });
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Please enter your email address."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setForgotSent(true);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) toast.error(error.message);
  };

  const sheetTitle = mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password";

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0a1628" }}>
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />
      <div className="absolute inset-x-0 top-0 z-10 pointer-events-none" style={{ height: "45%", background: "linear-gradient(to bottom, rgba(4,12,30,0.85) 0%, rgba(4,12,30,0.3) 60%, transparent 100%)" }} />
      <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "55%", background: "linear-gradient(to top, rgba(4,12,30,0.97) 55%, rgba(4,12,30,0.6) 80%, transparent 100%)" }} />

      {/* Hero */}
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center pt-16 px-6 fade-in">
        <div className="w-18 h-18 rounded-2xl booka-gradient flex items-center justify-center booka-shadow-blue mb-3" style={{ width: 72, height: 72 }}>
          <img src={bookaLogo} alt="Booka" className="w-14 h-14 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)", letterSpacing: "-0.02em" }}>BOOKA</h1>
        <p className="text-white/70 text-sm font-medium mt-2 text-center max-w-xs" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
          Find and book top service providers across Jamaica
        </p>
      </div>

      {/* Bottom CTA */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-10 space-y-3 slide-up">
        <Button
          data-testid="button-get-started"
          className="w-full h-14 text-base font-bold rounded-2xl booka-gradient booka-shadow-blue active:scale-[0.97] transition-all"
          onClick={() => openSheet("signup")}
        >
          Get Started — It's Free
        </Button>
        <Button
          data-testid="button-sign-in"
          variant="outline"
          className="w-full h-12 text-sm font-semibold rounded-2xl border-white/20 text-white bg-white/10 hover:bg-white/15 backdrop-blur-sm active:scale-[0.97] transition-all"
          onClick={() => openSheet("login")}
        >
          Sign In
        </Button>
        <p className="text-center text-xs text-white/40 pt-1">
          By continuing you agree to our Terms and Privacy Policy
        </p>
      </div>

      {/* Sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-card w-full rounded-t-3xl px-6 pt-5 pb-10 slide-up space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30" />

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-xl font-bold text-foreground">{sheetTitle}</h2>
              <button onClick={() => setSheetOpen(false)} className="p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all text-muted-foreground">
                ✕
              </button>
            </div>

            {/* Forgot Password Form */}
            {mode === "forgot" && (
              forgotSent ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-3xl">✉️</div>
                  <p className="font-bold text-foreground text-lg">Check your email</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
                  </p>
                  <Button className="w-full rounded-xl mt-2" onClick={() => openSheet("login")}>Back to Sign In</Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                  <Input
                    data-testid="input-forgot-email"
                    type="email" placeholder="Email address" value={email}
                    onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-12" required autoFocus
                  />
                  <Button data-testid="button-send-reset" type="submit" className="w-full h-12 rounded-xl font-semibold" disabled={loading}>
                    {loading ? "Sending…" : "Send Reset Link"}
                  </Button>
                  <button type="button" onClick={() => openSheet("login")} className="w-full text-center text-sm text-primary font-medium">
                    ← Back to Sign In
                  </button>
                </form>
              )
            )}

            {/* Login / Signup Form */}
            {(mode === "login" || mode === "signup") && (
              <>
                {/* Role toggle (signup only) */}
                {mode === "signup" && (
                  <div className="flex gap-2">
                    {(["customer", "store"] as const).map((r) => (
                      <button
                        key={r} type="button"
                        onClick={() => setRole(r)}
                        className={"flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all " + (role === r ? "bg-primary text-white border-primary booka-shadow-blue" : "bg-secondary border-border text-foreground")}
                      >
                        {r === "customer" ? "👤 Customer" : "🏪 Store Owner"}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {mode === "signup" && (
                    <Input data-testid="input-fullname" placeholder="Full name *" value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl h-12" required />
                  )}
                  {mode === "signup" && (
                    <Input data-testid="input-phone" type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl h-12" />
                  )}
                  <Input data-testid="input-email" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-12" required />
                  <Input data-testid="input-password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl h-12" required minLength={6} />

                  {mode === "login" && (
                    <button
                      type="button"
                      data-testid="link-forgot-password"
                      onClick={() => openSheet("forgot")}
                      className="w-full text-right text-xs text-primary font-medium"
                    >
                      Forgot password?
                    </button>
                  )}

                  <Button data-testid="button-submit-auth" type="submit" className="w-full h-12 rounded-xl font-semibold" disabled={loading}>
                    {loading ? (mode === "signup" ? "Creating account…" : "Signing in…") : (mode === "signup" ? "Create Account" : "Sign In")}
                  </Button>
                </form>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  data-testid="button-google"
                  variant="outline"
                  className="w-full h-12 rounded-xl font-semibold gap-2"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <span className="text-lg">G</span> Continue with Google
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    data-testid="link-toggle-mode"
                    onClick={() => openSheet(mode === "login" ? "signup" : "login")}
                    className="font-semibold text-primary"
                  >
                    {mode === "login" ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
