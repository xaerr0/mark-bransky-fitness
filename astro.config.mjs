import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://www.branskyfitness.com",

  // astro dev/preview don't resolve directory index files for static assets
  // under public/ (unlike most real static hosts, Cloudflare Pages included),
  // so /admin/ 404s without this explicit redirect to the actual file.
  redirects: {
    "/admin": "/admin/index.html",
  },

  output: "hybrid",
  adapter: cloudflare()
});