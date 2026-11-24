"use client";

import { useEffect } from "react";

/** Registra o service worker (public/sw.js) só no build de produção. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem service worker o site funciona igual; só perde a página offline.
    });
  }, []);
  return null;
}
