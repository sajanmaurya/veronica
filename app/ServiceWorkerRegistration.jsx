"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Veronica service worker registration failed:", error);
      });
    }
  }, []);

  return null;
}
