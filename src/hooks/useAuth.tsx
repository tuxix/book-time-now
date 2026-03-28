import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  role: string;
  is_admin: boolean;
  is_suspended: boolean;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContext {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("role, is_admin, is_suspended, full_name, phone, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return null;
    return {
      role: data.role ?? "customer",
      is_admin: data.is_admin ?? false,
      is_suspended: data.is_suspended ?? false,
      full_name: data.full_name ?? null,
      phone: data.phone ?? null,
      avatar_url: data.avatar_url ?? null,
    };
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, sess) => {
        if (!mounted) return;

        setSession(sess);
        setUser(sess?.user ?? null);

        if (sess?.user) {
          const uid = sess.user.id;
          (async () => {
            const prof = await fetchProfile(uid);
            if (!mounted) return;

            // On page load / token refresh: if we have a session but no profile
            // row, the account was deleted externally — sign out to un-stick the user.
            // For a brand-new SIGNED_IN event, allow RoleSelectPage to create the profile.
            if (!prof && event !== "SIGNED_IN" && event !== "USER_UPDATED") {
              await supabase.auth.signOut();
              if (!mounted) return;
              setUser(null);
              setSession(null);
              setProfile(null);
              setLoading(false);
              return;
            }

            setProfile(prof);
            setLoading(false);
          })();
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const prof = await fetchProfile(user.id);
    setProfile(prof);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  return (
    <Ctx.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
