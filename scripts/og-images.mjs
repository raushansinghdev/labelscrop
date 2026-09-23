/**
 * Generates the Open Graph share cards in `public/og/`.
 *
 * Why a committed script producing committed PNGs, rather than build-time generation:
 *
 * - The obvious build-time route (satori + resvg) needs TTF/OTF font data, and the site's font
 *   ships as woff2 only. Working around that means committing a duplicate font file anyway.
 * - `sharp` is already installed, but it rasterizes SVG text through librsvg using *system*
 *   fonts, so the card would silently render in a fallback face on CI where Geist isn't installed.
 * - A real browser gets the typography exactly right, and because the output is committed, the
 *   production build needs no image toolchain at all and cannot break on a font that is missing
 *   from the build container.
 *
 * The cost is that this is run by hand when the cards change. That is the right trade for assets
 * that change a few times a year.
 *
 * Usage:
 *   npm install --no-save playwright      # browsers are usually already cached
 *   node scripts/og-images.mjs
 */
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/og');

const BRAND = 'SellerWala';
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * One card per indexable page, plus the default.
 *
 * `eyebrow` names the tool, `title` is the promise, `points` are the objections answered. They
 * are shorter than the page's own copy on purpose: a share card is read at thumbnail size in a
 * WhatsApp list, so anything longer than about six words per line is decoration.
 */
const CARDS = [
	{
		slug: 'default',
		eyebrow: 'Free tools for Meesho sellers',
		title: 'Crop your labels.\nKnow your profit.',
		points: ['No login', 'Nothing uploaded', 'Free forever'],
	},
	{
		slug: 'meesho-label-cropper',
		eyebrow: 'Meesho Label Cropper',
		title: 'Print-ready labels\nin one click.',
		points: ['Invoice removed', '4x6 / 3x5 / A4', 'Sorted by SKU'],
	},
	{
		slug: 'meesho-profit-calculator',
		eyebrow: 'Meesho Profit Calculator',
		title: 'What did this month\nactually earn you?',
		points: ['Real settlement', 'Per-SKU margin', 'RTO counted'],
	},
	/*
	 * Hinglish cards for the `/hi/` pages. Worth generating rather than reusing the English ones:
	 * the share card is the only part of a page a WhatsApp group sees before deciding to tap, and
	 * these links get pasted into Hindi-speaking seller groups. An English card on a Hinglish page
	 * asks the reader to guess which language they are about to land in.
	 */
	{
		slug: 'hi-meesho-label-cropper',
		eyebrow: 'Meesho Label Cropper',
		title: 'Label crop karke\nseedha print.',
		points: ['Invoice hat jata hai', '4x6 / 3x5 / A4', 'SKU se sorted'],
	},
	{
		slug: 'hi-meesho-profit-calculator',
		eyebrow: 'Meesho Profit Calculator',
		title: 'Is mahine kamai\nsach mein kitni hui?',
		points: ['Asli settlement', 'Per-SKU margin', 'RTO bhi gina'],
	},
];

/** Inlined as a data URI so the page never waits on a network font. */
async function fontDataUri() {
	const path = resolve(root, 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2');
	const buf = await readFile(path);
	return `data:font/woff2;base64,${buf.toString('base64')}`;
}

function html(card, font) {
	// The title carries a literal newline in the data; honour it rather than guessing a wrap.
	const titleHtml = card.title
		.split('\n')
		.map((line) => `<span>${line}</span>`)
		.join('');
	const pointsHtml = card.points.map((p) => `<li>${p}</li>`).join('');

	return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: 'Geist';
    src: url('${font}') format('woff2');
    font-weight: 100 900;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    font-family: 'Geist', system-ui, sans-serif;
    background: #ffffff;
    color: #111111;
    display: flex; flex-direction: column;
    justify-content: space-between;
    padding: 72px 80px;
    position: relative;
    overflow: hidden;
  }
  /* A single soft wash of brand colour. Anything busier competes with the text at the size
     this is actually viewed, which is about 300px wide in a chat list. */
  body::after {
    content: ''; position: absolute; right: -180px; top: -180px;
    width: 620px; height: 620px; border-radius: 50%;
    background: radial-gradient(circle, rgba(43,98,239,0.16) 0%, rgba(43,98,239,0) 70%);
  }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
  /* The mark's closing stroke is meant to leave the tile, and the tile's hidden overflow is what
     cuts it — so the glyph fills the tile rather than sitting centred in it. The geometry itself
     is documented in scripts/icons.mjs, which is where it is defined. */
  .mark { width: 42px; height: 42px; border-radius: 11px; overflow: hidden;
          background: linear-gradient(135deg, #2b62ef, #1b3ea8); }
  .mark svg { display: block; width: 42px; height: 42px; stroke: #fff; fill: none;
              stroke-width: 4.2; stroke-linecap: butt; stroke-linejoin: miter; }
  .eyebrow { font-size: 26px; font-weight: 500; color: #2b62ef; margin-bottom: 20px; }
  h1 { font-size: 78px; line-height: 1.06; font-weight: 700; letter-spacing: -0.035em; display: flex; flex-direction: column; }
  ul { display: flex; gap: 14px; list-style: none; }
  li { font-size: 25px; font-weight: 500; color: #3f3f46;
       background: #f4f4f5; border: 1px solid #e4e4e7;
       padding: 12px 24px; border-radius: 999px; }
  .middle { position: relative; z-index: 1; }
</style></head>
<body>
  <div class="brand">
    <span class="mark"><svg viewBox="0 0 48 48"><path d="M14.7 18 L19.8 30 L24 22.2 L28.2 30 L40.8 1.2"/></svg></span>
    ${BRAND}
  </div>
  <div class="middle">
    <div class="eyebrow">${card.eyebrow}</div>
    <h1>${titleHtml}</h1>
  </div>
  <ul>${pointsHtml}</ul>
</body></html>`;
}

const font = await fontDataUri();
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

for (const card of CARDS) {
	await page.setContent(html(card, font), { waitUntil: 'load' });
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: resolve(outDir, `${card.slug}.png`) });
	console.log(`og/${card.slug}.png`);
}

await browser.close();
