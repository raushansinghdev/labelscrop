// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';

// The GitHub Pages workflow sets GITHUB_PAGES=true so the dev site is served from
// https://raushansinghdev.github.io/labelscrop/. Regular builds keep the production domain.
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

// https://astro.build/config
export default defineConfig({
  site: isGitHubPages ? 'https://raushansinghdev.github.io' : 'https://labelscrop.com',
  base: isGitHubPages ? '/labelscrop' : '/',
  // The Amazon/Flipkart pages are roadmap placeholders carrying almost no content. They're
  // marked noindex until the adapters ship, so they must stay out of the sitemap too —
  // submitting a noindex URL is a contradictory signal Search Console flags as an error.
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !/\/tools\/(amazon|flipkart)-label-cropper\/?$/.test(new URL(page).pathname)
    }),
    partytown()
  ],

  vite: {
    plugins: [tailwindcss()],
    // The tool imports these lazily (only once a file is added / Create is pressed), so without this Vite's
    // dev server discovers them mid-session, re-optimizes, and bumps their ?v= hash — an already-open tab
    // then fails with "error loading dynamically imported module". Pre-bundling them at startup avoids that.
    // The same happens when a component starts using a UI primitive the page didn't use before (the island
    // fails to hydrate and every button goes dead), so every Base UI entry used in src/components/ui is listed too.
    optimizeDeps: {
      include: [
        'comlink',
        'pdf-lib',
        'pdfjs-dist/legacy/build/pdf.mjs',
        '@base-ui/react/button',
        '@base-ui/react/dialog',
        '@base-ui/react/progress',
        '@base-ui/react/radio',
        '@base-ui/react/radio-group',
        '@base-ui/react/select',
        '@base-ui/react/switch',
        '@base-ui/react/tabs',
        '@base-ui/react/tooltip'
      ]
    }
  }
});
