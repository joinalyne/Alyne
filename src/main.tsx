import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/index.css";
import { initPixels } from "./lib/pixels";

// Before render: the page-view event should not wait on React.
initPixels();

createRoot(document.getElementById("root")!).render(<App />);

// PWA: register the service worker in production builds only
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[pwa] service worker registration failed:", err);
    });
  });
}
