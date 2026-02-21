import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, tenantActive } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // If tenant is paused, show message and force logout
  if (profile?.tenant_id && !tenantActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <ShieldAlert className="h-16 w-16 text-destructive/50 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Business Paused</h2>
          <p className="text-sm text-muted-foreground mb-6">Your business account has been paused by the administrator. Please contact support.</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If user is deactivated
  if (profile && !profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <ShieldAlert className="h-16 w-16 text-accent/50 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Account Deactivated</h2>
          <p className="text-sm text-muted-foreground mb-6">Your account has been deactivated. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  // If no tenant, redirect to onboarding
  if (profile && !profile.tenant_id) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
