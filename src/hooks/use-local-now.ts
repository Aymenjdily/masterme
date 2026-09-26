import { useSyncExternalStore } from "react";

// Browser-local "YYYY-MM-DD|hour", refreshed every minute; empty during SSR.
function subscribeToMinutes(callback: () => void) {
  const id = setInterval(callback, 60_000);
  return () => clearInterval(id);
}

function localNowSnapshot() {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${day}|${now.getHours()}`;
}

/** The browser's local date (YYYY-MM-DD) and hour; `ready` is false on the server. */
export function useLocalNow() {
  const snapshot = useSyncExternalStore(subscribeToMinutes, localNowSnapshot, () => "");
  const [day, hour] = snapshot.split("|");
  return { ready: snapshot !== "", day: day ?? "", hour: snapshot ? Number(hour) : -1 };
}
