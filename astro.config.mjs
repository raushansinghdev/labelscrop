// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';

// https://astro.build/config
export default defineConfig({
  site: 'https://labelscrop.com',
  integrations: [react(), sitemap(), partytown()],

  vite: {
    plugins: [tailwindcss()]
  }
});