/// <reference types="vite/client" />
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// PWA: aktifkan service worker agar aplikasi bisa diinstal & bekerja offline di HP
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* lingkungan tanpa dukungan SW tetap berjalan normal */
    });
  });
}
