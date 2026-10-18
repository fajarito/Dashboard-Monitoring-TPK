import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Driver pg (native) harus di luar bundler server.
  serverExternalPackages: ["pg"],
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
