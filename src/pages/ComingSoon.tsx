import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";

export default function ComingSoon() {
  const location = useLocation();
  const pageName = location.pathname.replace('/', '').replace(/-/g, ' ');

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center">
          <Construction className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-foreground capitalize">{pageName || 'Page'}</h2>
        <p className="text-muted-foreground">This module is coming soon.</p>
        <p className="text-xs text-muted-foreground/60">Connect Lovable Cloud to enable full backend functionality.</p>
      </div>
    </div>
  );
}
