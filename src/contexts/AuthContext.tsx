import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  tenant_id: string | null;
  branch_id: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  tenantId: string | null;
  branchId: string | null;
  loading: boolean;
  tenantActive: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  refreshProfile: () => Promise<void>;
  getPageAccess: () => string[];
}

const PAGE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "branches", "devices", "payments", "whatsapp", "settings", "users", "super-admin", "attendance", "transfers", "returns", "shortages", "cash-register"],
  admin: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "branches", "devices", "payments", "whatsapp", "settings", "users", "attendance", "transfers", "returns", "shortages", "cash-register"],
  manager: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "payments", "attendance", "transfers", "returns", "shortages", "cash-register"],
  cashier: ["dashboard", "pos", "customers", "invoices", "attendance", "shortages", "cash-register"],
  staff: ["dashboard", "inventory", "attendance"],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantActive, setTenantActive] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data);
    
    // Check if tenant is active
    if (data?.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("is_active")
        .eq("id", data.tenant_id)
        .single();
      const active = tenant?.is_active ?? true;
      setTenantActive(active);
      
      // Force logout if tenant is paused or user is deactivated
      if (!active || !data.is_active) {
        await supabase.auth.signOut();
        return null;
      }
    }
    return data;
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const r = data?.map((d) => d.role) || [];
    setRoles(r);
    return r;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchRoles(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            await fetchProfile(session.user.id);
            await fetchRoles(session.user.id);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(() => {
          fetchRoles(session.user.id).then(() => setLoading(false));
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime listener for forced logouts
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel(`auth_status_${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new.is_active === false) {
          toast.error("Your account has been deactivated by the admin.");
          signOut();
          window.location.href = "/auth";
        }
      });

    if (profile.tenant_id) {
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${profile.tenant_id}` }, (payload) => {
        if (payload.new.is_active === false) {
          toast.error("Your business account has been paused by the Super Admin.");
          signOut();
          window.location.href = "/auth";
        }
      });
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.user) {
      // ----- Tenant & user status check BEFORE letting them in -----
      const { data: prof } = await supabase
        .from("profiles")
        .select("tenant_id, is_active")
        .eq("user_id", data.user.id)
        .single();

      // User account deactivated
      if (prof && prof.is_active === false) {
        await supabase.auth.signOut();
        throw new Error("Your account has been deactivated. Please contact your administrator.");
      }

      if (prof?.tenant_id) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("is_active, max_sessions")
          .eq("id", prof.tenant_id)
          .single();

        // Tenant paused by super admin
        if (tenant && tenant.is_active === false) {
          await supabase.auth.signOut();
          throw new Error("⛔ Your business account has been paused. Please contact the administrator.");
        }

        // Session limit check
        const maxSessions = (tenant as any)?.max_sessions || 5;
        const { data: sessions } = await supabase
          .from("active_sessions")
          .select("id")
          .eq("tenant_id", prof.tenant_id);

        if (sessions && sessions.length >= maxSessions) {
          await supabase.auth.signOut();
          throw new Error(`Maximum ${maxSessions} concurrent sessions reached. Ask an admin to terminate a session.`);
        }

        const deviceName = navigator.userAgent.includes("Mobile") ? "Mobile Device"
          : navigator.userAgent.includes("Chrome") ? "Chrome Browser"
          : navigator.userAgent.includes("Firefox") ? "Firefox Browser"
          : navigator.userAgent.includes("Safari") ? "Safari Browser" : "Unknown Browser";

        await supabase.from("active_sessions").upsert({
          user_id: data.user.id,
          tenant_id: prof.tenant_id,
          device_name: deviceName,
          last_active_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    }
  };

  const signOut = async () => {
    // Remove active session before signing out
    if (user) {
      await supabase.from("active_sessions").delete().eq("user_id", user.id);
    }
    await supabase.auth.signOut();
  };

  const hasRole = (role: string) => roles.includes(role);

  const [customPages, setCustomPages] = useState<string[] | null>(null);

  // Fetch custom page access when user changes
  useEffect(() => {
    if (user && profile?.tenant_id) {
      supabase.from("user_page_access").select("pages").eq("user_id", user.id).eq("tenant_id", profile.tenant_id).maybeSingle()
        .then(({ data }) => {
          if (data && (data as any).pages?.length > 0) setCustomPages((data as any).pages);
          else setCustomPages(null);
        });
    } else {
      setCustomPages(null);
    }
  }, [user, profile?.tenant_id]);

  const getPageAccess = (): string[] => {
    // Custom page access overrides role-based access
    if (customPages && customPages.length > 0) return customPages;
    const allPages = new Set<string>();
    for (const role of roles) {
      const pages = PAGE_PERMISSIONS[role] || [];
      pages.forEach(p => allPages.add(p));
    }
    if (allPages.size === 0 && profile?.tenant_id) {
      return PAGE_PERMISSIONS.staff;
    }
    return Array.from(allPages);
  };

  // Heartbeat: update last_active_at every 60 seconds
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    if (user) {
      const beat = () => {
        supabase.from("active_sessions").update({ last_active_at: new Date().toISOString() }).eq("user_id", user.id).then(() => {});
      };
      beat();
      heartbeatRef.current = setInterval(beat, 60_000);
    }
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        tenantId: profile?.tenant_id ?? null,
        branchId: profile?.branch_id ?? null,
        loading,
        tenantActive,
        signUp,
        signIn,
        signOut,
        hasRole,
        refreshProfile,
        getPageAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
