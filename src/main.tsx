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
  }
});

createRoot(document.getElementById("root")!).render(<App />);

