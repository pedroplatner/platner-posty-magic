import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let wasOffline = !navigator.onLine;
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      if (wasOffline) {
        toast.success("Conexão restaurada");
        wasOffline = false;
      }
    };
    const goOffline = () => {
      setOnline(false);
      wasOffline = true;
      toast.error("Sem conexão", { description: "Algumas ações ficarão indisponíveis." });
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;
  return (
    <div className="bg-destructive text-destructive-foreground text-sm py-2 px-4 flex items-center justify-center gap-2 sticky top-0 z-50">
      <WifiOff className="h-4 w-4" />
      Sem conexão. Verificando…
    </div>
  );
}
