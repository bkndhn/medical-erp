import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL = 60_000; // 1 minute

export function useHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!userId) return;

    const beat = () => {
      supabase
        .from("active_sessions")
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", userId)
        .then(() => {});
    };

    // Beat immediately on mount
    beat();
    intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);
}
