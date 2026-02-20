import { useNavigate } from "react-router-dom";
import { industries } from "@/data/mockData";
import { Zap, ArrowRight } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl text-center space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center glow-primary">
            <Zap className="h-7 w-7 text-primary" />
          </div>
        </div>

        <div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Cloud<span className="text-gradient-primary">ERP</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-3">
            Multi-Industry • Multi-Branch • Ultra Fast POS
          </p>
        </div>

        {/* Industry Select */}
        <div>
          <p className="text-sm text-muted-foreground mb-4">Select your industry to get started</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {industries.map((ind) => (
              <button
                key={ind.id}
                onClick={() => navigate('/dashboard')}
                className="glass-card-hover rounded-xl p-5 text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{ind.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{ind.label}</p>
                    <p className="text-xs text-muted-foreground">{ind.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Powered by Lovable Cloud • Enterprise Grade Security
        </p>
      </div>
    </div>
  );
}
