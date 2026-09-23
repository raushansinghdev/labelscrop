/**
 * Generates the favicon and app-icon set in `public/`.
 *
 * The site was still shipping Astro's stock starter favicon, which meant every browser tab, every
 * bookmark, and every Android home-screen shortcut carried someone else's logo. The mark here is
 * the same one used on the Open Graph cards (`scripts/og-images.mjs`) so the brand looks like one
 * thing wherever it shows up.
 *
 * Rasterized with `sharp`, which Astro already installs for `astro:assets` — no new dependency.
 * Sharp renders SVG through librsvg, which is unreliable for *text* but perfectly fine for the
 * paths and shapes used here, so there is no font to go missing on a build machine.
 *
 * Usage: node scripts/icons.mjs
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = resolve(root, 'public');

const BRAND_BLUE = '#2b62ef';
const BRAND_DEEP = '#1b3ea8';

/*
 * The mark: the W of "Wala", drawn the way a seller's month goes — two dips, and a close that
 * clears where it opened. The last stroke keeps rising past the frame and is cut off by it,
 * which is the whole idea and the reason this reads as nobody else's logo. What it replaced was
 * Lucide's stock `crop` glyph: the same paths behind a dozen unrelated apps, and a promise the
 * brand stopped keeping the day the profit calculator shipped.
 *
 * Coordinates are on a 48-unit grid that maps to the tile itself, so the glyph's relationship to
 * the frame — where it leaves — is fixed and cannot drift between sizes. This file is the source
 * of the geometry; Header.astro, Footer.astro and og-images.mjs carry the same path inline.
 */
const GLYPH = 'M14.7 18 L19.8 30 L24 22.2 L28.2 30 L40.8 1.2';
/* Contained variant, stopping inside the frame, for the one icon that cannot break out (below). */
const GLYPH_CONTAINED = 'M14.7 18 L19.8 30 L24 22.2 L28.2 30 L33.3 15.6';
const STROKE = 4.2;

/**
 * The mark on a rounded square.
 *
 * `glyphScale` shrinks the letter about the tile's centre for icons that get masked by the OS.
 * `contained: true` goes with it: a breakout stroke that stops short of an edge it never reaches
 * reads as a mistake, so the shrunken version uses the letter that closes on its own.
 */
function markSvg({ size, radius = 0.24, glyphScale = 1, contained = false, background }) {
	const scale = (size / 48) * glyphScale;
	// Centre the glyph box rather than the ink: the letter is drawn optically centred within it.
	const offset = (size - 48 * scale) / 2;
	const fill = background ?? `url(#brand-${size})`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="brand-${size}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_BLUE}"/>
      <stop offset="1" stop-color="${BRAND_DEEP}"/>
    </linearGradient>
    <clipPath id="tile-${size}">
      <rect width="${size}" height="${size}" rx="${size * radius}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${fill}"/>
  <g clip-path="url(#tile-${size})">
    <g transform="translate(${offset} ${offset}) scale(${scale})"
       fill="none" stroke="#ffffff" stroke-width="${STROKE}"
       stroke-linecap="butt" stroke-linejoin="miter">
      <path d="${contained ? GLYPH_CONTAINED : GLYPH}"/>
    </g>
  </g>
</svg>`;
}

/*
 * The scalable favicon is written by hand rather than rasterized: it stays crisp at any size and
 * is what modern browsers prefer. A full-bleed rounded square reads better than a bare glyph at
 * 16px, where a thin stroke on a transparent background turns to mush.
 */
await writeFile(resolve(pub, 'favicon.svg'), markSvg({ size: 128 }));
console.log('favicon.svg');

const raster = [
	// iOS ignores transparency and applies its own mask, so this one is full-bleed and square;
	// the mask trims the corner the stroke leaves through, which is the same reading anyway.
	{ file: 'apple-touch-icon.png', size: 180, radius: 0 },
	{ file: 'icon-192.png', size: 192 },
	{ file: 'icon-512.png', size: 512 },
	// Android crops maskable icons to a circle, so the frame the letter would break out of is
	// never on screen. This one keeps the letter whole instead. No shrinking needed: the letter's
	// furthest ink sits 156px from the centre, well inside the 205px safe radius at this size.
	{ file: 'icon-maskable-512.png', size: 512, radius: 0, contained: true },
];

for (const icon of raster) {
	await sharp(Buffer.from(markSvg(icon))).png().toFile(resolve(pub, icon.file));
	console.log(icon.file);
}

/**
 * `favicon.ico`, built by hand because sharp cannot write the format.
 *
 * Worth keeping at all, in an SVG world: browsers request `/favicon.ico` from the site root on
 * their own, with no `<link>` tag involved, so deleting it leaves a 404 on a path that really
 * does get hit — by browsers, by feed readers, and by the link-preview bots behind chat apps.
 *
 * The file this replaces was Astro's starter logo, and it was not even a real ICO: it was a 32x32
 * PNG with an `.ico` extension. That works by accident, because browsers sniff the content.
 *
 * A modern ICO may hold PNG data directly rather than the old BMP-with-AND-mask layout, which is
 * what this writes — supported everywhere that matters, and a fraction of the size. Structure is
 * a 6-byte header, one 16-byte directory entry per image, then the PNGs.
 */
async function writeIco(sizes, file) {
	const images = await Promise.all(
		sizes.map((size) => sharp(Buffer.from(markSvg({ size }))).png().toBuffer()),
	);

	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // 1 = icon (2 would be a cursor)
	header.writeUInt16LE(images.length, 4);

	const directory = Buffer.alloc(16 * images.length);
	let offset = header.length + directory.length;

	images.forEach((png, index) => {
		const at = index * 16;
		// 0 means 256 in this field, which is why it is a single byte and still covers 256px.
		directory.writeUInt8(sizes[index] >= 256 ? 0 : sizes[index], at);
		directory.writeUInt8(sizes[index] >= 256 ? 0 : sizes[index], at + 1);
		directory.writeUInt8(0, at + 2); // palette size; 0 for truecolour
		directory.writeUInt8(0, at + 3); // reserved
		directory.writeUInt16LE(1, at + 4); // colour planes
		directory.writeUInt16LE(32, at + 6); // bits per pixel
		directory.writeUInt32LE(png.length, at + 8);
		directory.writeUInt32LE(offset, at + 12);
		offset += png.length;
	});

	await writeFile(resolve(pub, file), Buffer.concat([header, directory, ...images]));
	console.log(`${file} (${sizes.join(', ')}px)`);
}

// 16 and 32 are the sizes browsers actually draw in a tab and a bookmark bar; 48 is what Windows
// uses for a pinned shortcut.
await writeIco([16, 32, 48], 'favicon.ico');

const manifest = {
	name: 'SellerWala — Free tools for Indian e-commerce sellers',
	short_name: 'SellerWala',
	description:
		'Crop and sort marketplace shipping labels for printing, and work out your real seller profit. Free, no login, runs entirely in your browser.',
	start_url: '/',
	scope: '/',
	display: 'standalone',
	background_color: '#ffffff',
	theme_color: '#ffffff',
	lang: 'en-IN',
	categories: ['business', 'productivity', 'utilities'],
	icons: [
		{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
		{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
	],
};

await writeFile(resolve(pub, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('site.webmanifest');
