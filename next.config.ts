import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repoName = "pokemon_bo3_tw_manager";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isProd ? `/${repoName}` : undefined,
  assetPrefix: isProd ? `/${repoName}/` : undefined,
};

export default nextConfig;
