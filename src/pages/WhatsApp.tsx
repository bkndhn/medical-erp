import { MessageSquare, Send, Settings } from "lucide-react";

export default function WhatsApp() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> WhatsApp Integration</h1>
        <p className="text-sm text-muted-foreground">Send invoices, reminders & reports via WhatsApp</p>
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-success/10 flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">WhatsApp Business API</h2>
          <p className="text-sm text-muted-foreground">Connect your WhatsApp Business account to send invoices, payment reminders, daily summaries, and shift reports directly to your customers and staff.</p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="glass-card rounded-xl p-4 text-left">
              <Send className="h-5 w-5 text-primary mb-2" />
              <p className="text-xs font-semibold text-foreground">Auto-Send Invoices</p>
              <p className="text-xs text-muted-foreground mt-1">PDF or text invoice on sale completion</p>
            </div>
            <div className="glass-card rounded-xl p-4 text-left">
              <Settings className="h-5 w-5 text-accent mb-2" />
              <p className="text-xs font-semibold text-foreground">Due Reminders</p>
              <p className="text-xs text-muted-foreground mt-1">Automatic payment reminders</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 pt-2">Configure your WhatsApp API key in Settings to enable this feature.</p>
        </div>
      </div>
    </div>
  );
}
