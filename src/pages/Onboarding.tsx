import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const industries = [
  { id: "grocery", label: "Grocery", icon: "🛒", description: "General store, supermarket, FMCG" },
  { id: "textile", label: "Textile", icon: "👔", description: "Fashion, garments, fabrics" },
  { id: "medical", label: "Medical", icon: "💊", description: "Pharmacy, clinic, medical store" },
  { id: "fruit", label: "Fruit & Produce", icon: "🍎", description: "Fresh fruits, vegetables, perishables" },
  { id: "custom", label: "Custom", icon: "⚙️", description: "Custom industry configuration" },
] as const;

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState<string>("grocery");
  const [branchName, setBranchName] = useState("Main Branch");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Create tenant
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .insert({ name: businessName, industry: industry as any, owner_id: user.id })
        .select()
        .single();
      if (tErr) throw tErr;

      // Update profile with tenant_id first (so RLS policies work)
      await supabase
        .from("profiles")
        .update({ tenant_id: tenant.id })
        .eq("user_id", user.id);

      // Assign admin role
      await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: "admin" as any });

      // Now create branch (RLS can resolve tenant_id from profile)
      const { data: branch, error: bErr } = await supabase
        .from("branches")
        .insert({ tenant_id: tenant.id, name: branchName })
        .select()
        .single();
      if (bErr) throw bErr;

      // Update profile with branch_id
      await supabase
        .from("profiles")
        .update({ branch_id: branch.id })
        .eq("user_id", user.id);

      await refreshProfile();
      toast.success("Business created successfully!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center glow-primary">
            <Zap className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-foreground mb-1">Set Up Your Business</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Step {step} of 2</p>

        <div className="glass-card rounded-2xl p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your Business Name"
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Branch Name</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Main Branch"
                  className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button
                onClick={() => businessName && setStep(2)}
                disabled={!businessName}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Select Your Industry</p>
              <div className="grid grid-cols-1 gap-2">
                {industries.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => setIndustry(ind.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      industry === ind.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border hover:border-primary/20 bg-muted/30"
                    }`}
                  >
                    <span className="text-2xl">{ind.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{ind.label}</p>
                      <p className="text-xs text-muted-foreground">{ind.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-lg bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Create Business
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
