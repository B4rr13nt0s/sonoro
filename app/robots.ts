import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo/site.ts";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/carrito", "/styleguide", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
