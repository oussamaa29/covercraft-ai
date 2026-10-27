import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public pages only — the dashboard and API are disallowed in robots.ts.
const PATHS = ["/", "/pricing", "/register", "/login", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.map((path) => ({
    url: path === "/" ? base : `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
