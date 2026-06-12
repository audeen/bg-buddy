import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Erlaubt Zugriff aus dem Heimnetz im Dev-Modus (z.B. Handy via
  // http://192.168.2.x:3000). Ohne das blockt Next.js die Dev-Endpoints
  // cross-origin — der Client hydratisiert nie und Login/Interaktion tun nichts.
  allowedDevOrigins: ["192.168.2.*"],
};

export default nextConfig;
