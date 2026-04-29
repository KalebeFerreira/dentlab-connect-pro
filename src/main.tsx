// Entry + global guards
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Some browser extensions (e.g. MetaMask) inject scripts that can throw unhandled
// promise rejections unrelated to this app. If not handled, they may trigger a
// blank-screen error overlay in some environments.
window.addEventListener("unhandledrejection", (event) => {
  const reason: any = event.reason;
  const message =
    typeof reason === "string" ? reason : typeof reason?.message === "string" ? reason.message : "";
  const stack = typeof reason?.stack === "string" ? reason.stack : "";

  // MetaMask extension id: nkbihfbeogaeaoehlefnkodbefgpgknn
  if (message.includes("MetaMask") || stack.includes("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn")) {
    event.preventDefault();
    return;
  }

  // Stale chunk after a new deploy: index.html references hashed JS files that
  // no longer exist on the CDN. Force a one-time hard reload to pick up the new bundle.
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      message
    )
  ) {
    event.preventDefault();
    const KEY = "__chunk_reload__";
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, "1");
      window.location.reload();
    }
  }
});

// Clear the reload guard once the app has successfully booted.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem("__chunk_reload__"), 5000);
});

createRoot(document.getElementById("root")!).render(<App />);

