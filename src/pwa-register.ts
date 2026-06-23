// Guarded PWA service worker registration with an update prompt.
// Only registers in production browser contexts (skips Lovable preview/iframe/dev).
import { toast } from "sonner";

const SW_URL = "/sw.js";

function isUnsupportedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppSWs() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        return url.endsWith(SW_URL);
      })
      .map((r) => r.unregister())
  );
}

export async function registerPwa() {
  if (isUnsupportedContext()) {
    await unregisterAppSWs();
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast("Nova versão disponível", {
          description: "Toque para atualizar o app.",
          duration: Infinity,
          action: {
            label: "Atualizar",
            onClick: () => updateSW(true),
          },
        });
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Check for updates on focus and every 30 min.
        const check = () => registration.update().catch(() => {});
        window.addEventListener("focus", check);
        setInterval(check, 30 * 60 * 1000);
      },
    });
  } catch (e) {
    console.warn("[pwa] registration failed", e);
  }
}
