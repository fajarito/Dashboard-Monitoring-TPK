import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Driver pg (native) harus di luar bundler server.
  serverExternalPackages: ["pg"],
  // Dev diakses via 127.0.0.1 sementara next listen 0.0.0.0 — tanpa ini
  // HMR/hydration bisa macet dan fetch agregat di client tidak jalan.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
