import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qlv-media-prod.qatarliving.com",
      },
      {
        protocol: "https",
        hostname: "**.qatarsale.com",
      },
      // Mzad Qatar images. The exact CDN host is TBD — confirm against a real
      // listing's image URL once SCRAPERAPI_KEY is set and tighten if needed.
      {
        protocol: "https",
        hostname: "**.mzadqatar.com",
      },
    ],
  },
};

export default nextConfig;
