import { useState, useEffect } from "react";
import { Download, Smartphone, Monitor, Apple, Chrome, Share, Plus, ArrowDown, CheckCircle2, ExternalLink } from "lucide-react";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);

    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Already Installed!</h1>
          <p className="text-muted-foreground">This app is already installed on your device. Open it from your home screen for the best experience.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-primary/10 to-background px-6 py-12 text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6">
          <Download className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Install App</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Install this app on your device for faster access, offline support, and a native app experience — no app store needed.
        </p>

        {deferredPrompt && (
          <button onClick={handleInstall} className="mt-6 px-8 py-3 rounded-xl bg-primary text-primary-foreground text-lg font-semibold hover:bg-primary/90 transition-all touch-manipulation shadow-lg shadow-primary/20">
            <Download className="h-5 w-5 inline mr-2" /> Install Now
          </button>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-6 space-y-8 mt-8">
        {/* Platform tabs */}
        <div className="flex gap-2 justify-center">
          {([
            { id: "ios", label: "iPhone / iPad", icon: Apple },
            { id: "android", label: "Android", icon: Smartphone },
            { id: "desktop", label: "Desktop", icon: Monitor },
          ] as const).map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all touch-manipulation ${platform === p.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              <p.icon className="h-4 w-4" /> {p.label}
            </button>
          ))}
        </div>

        {/* iOS Instructions */}
        {platform === "ios" && (
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Apple className="h-5 w-5 text-primary" /> Install on iPhone / iPad
            </h2>
            <div className="space-y-4">
              {[
                { step: 1, icon: <Share className="h-5 w-5" />, title: "Tap the Share button", desc: "Look for the share icon (square with arrow) at the bottom of Safari" },
                { step: 2, icon: <Plus className="h-5 w-5" />, title: "Tap \"Add to Home Screen\"", desc: "Scroll down in the share menu and tap \"Add to Home Screen\"" },
                { step: 3, icon: <CheckCircle2 className="h-5 w-5" />, title: "Tap \"Add\"", desc: "Confirm the name and tap Add in the top right corner" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">{s.step}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">{s.icon} {s.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-xs text-accent font-medium">⚠️ Important: Use Safari browser. Chrome on iOS doesn't support installing web apps.</p>
            </div>
          </div>
        )}

        {/* Android Instructions */}
        {platform === "android" && (
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Install on Android
            </h2>
            {deferredPrompt ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Tap the button below to install instantly:</p>
                <button onClick={handleInstall} className="px-8 py-3 rounded-xl bg-primary text-primary-foreground text-lg font-semibold hover:bg-primary/90 transition-all touch-manipulation">
                  <Download className="h-5 w-5 inline mr-2" /> Install App
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { step: 1, icon: <Chrome className="h-5 w-5" />, title: "Open in Chrome", desc: "Make sure you're viewing this page in Google Chrome" },
                  { step: 2, icon: <ExternalLink className="h-5 w-5" />, title: "Tap the menu (⋮)", desc: "Tap the three-dot menu in the top-right corner" },
                  { step: 3, icon: <Plus className="h-5 w-5" />, title: "Tap \"Install app\" or \"Add to Home screen\"", desc: "You may see either option depending on your Chrome version" },
                  { step: 4, icon: <CheckCircle2 className="h-5 w-5" />, title: "Confirm install", desc: "Tap Install to add the app to your home screen" },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">{s.step}</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">{s.icon} {s.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Desktop Instructions */}
        {platform === "desktop" && (
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" /> Install on Desktop
            </h2>
            {deferredPrompt ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Click below to install:</p>
                <button onClick={handleInstall} className="px-8 py-3 rounded-xl bg-primary text-primary-foreground text-lg font-semibold hover:bg-primary/90 transition-all">
                  <Download className="h-5 w-5 inline mr-2" /> Install App
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { step: 1, icon: <Chrome className="h-5 w-5" />, title: "Open in Chrome or Edge", desc: "This app works best with Chrome or Microsoft Edge" },
                  { step: 2, icon: <ArrowDown className="h-5 w-5" />, title: "Click the install icon", desc: "Look for the install icon (⊕) in the address bar, or find \"Install app\" in the browser menu" },
                  { step: 3, icon: <CheckCircle2 className="h-5 w-5" />, title: "Confirm", desc: "Click Install to add the app to your desktop" },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">{s.step}</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">{s.icon} {s.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Benefits */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">Why Install?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: "⚡", title: "Faster Loading", desc: "App loads instantly from your device" },
              { icon: "📴", title: "Works Offline", desc: "Use POS even without internet" },
              { icon: "🔔", title: "Notifications", desc: "Get stock alerts and updates" },
              { icon: "📱", title: "Native Feel", desc: "Full-screen app experience" },
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <span className="text-xl">{b.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
