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
  integrations: [react(), sitemap(), partytown()],

  vite: {
    plugins: [tailwindcss()]
  }
});
