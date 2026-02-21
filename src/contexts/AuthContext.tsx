import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  super_admin: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "branches", "devices", "payments", "whatsapp", "settings", "users", "super-admin"],
  admin: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "branches", "devices", "payments", "whatsapp", "settings", "users"],
  manager: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "payments"],
  cashier: ["dashboard", "pos", "customers", "invoices"],
  staff: ["dashboard", "inventory"],
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: string) => roles.includes(role);

  const getPageAccess = (): string[] => {
    const allPages = new Set<string>();
    for (const role of roles) {
      const pages = PAGE_PERMISSIONS[role] || [];
      pages.forEach(p => allPages.add(p));
    }
    // If no roles but has tenant, give basic access
    if (allPages.size === 0 && profile?.tenant_id) {
      return PAGE_PERMISSIONS.staff;
    }
    return Array.from(allPages);
  };

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
