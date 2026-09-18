import type { NextConfig } from "next";

function pagesBasePath() {
  if (process.env.BASE_PATH != null) return process.env.BASE_PATH;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return "";
  const name = repo.split("/")[1] ?? "";
  if (!name || name.endsWith(".github.io")) return "";
  return `/${name}`;
}

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: pagesBasePath(),
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0"],
};

export default nextConfig;
