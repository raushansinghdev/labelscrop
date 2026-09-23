/**
 * Generates the explanatory diagrams in `src/assets/`.
 *
 * Why these are drawn rather than screenshotted:
 *
 * A real Meesho label carries a customer's name, full address and phone number. Publishing a
 * screenshot of one — even a seller's own export — puts a stranger's home address on a public
 * page that Google Images will happily index and cache. There is no redaction careful enough to
 * make that a good idea, so every diagram here is drawn from scratch, and the places where real
 * data would sit are drawn as grey placeholder bars. That is also the clearer illustration: the
 * point of the picture is where the page *splits*, not what any one customer is called.
 *
 * The rendering approach is the same as `og-images.mjs` — a real browser, the site's own font
 * inlined, output committed — for the same reason: the production build then needs no image
 * toolchain and cannot break on a missing font. See that file's header for the full argument.
 *
 * Output goes to `src/assets/` rather than `public/` so `astro:assets` can process it: pages get
 * width/height (no layout shift), modern formats, and responsive `srcset` for free.
 *
 * Usage:
 *   npm install --no-save playwright
 *   node scripts/diagrams.mjs
 */
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'src/assets');

/* Rendered at 2x so the image still looks sharp on the phone screens this site is mostly read on,
   where CSS pixels are the minority. Astro downscales from here. */
const SCALE = 2;

const C = {
	ink: '#111111',
	muted: '#71717a',
	faint: '#a1a1aa',
	line: '#e4e4e7',
	paper: '#ffffff',
	wash: '#fafafa',
	primary: '#2b62ef',
	primarySoft: '#eef2ff',
	cut: '#dc2626',
	good: '#16a34a',
	goodSoft: '#dcfce7',
};

async function fontDataUri() {
	const path = resolve(root, 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2');
	const buf = await readFile(path);
	return `data:font/woff2;base64,${buf.toString('base64')}`;
}

/** Shared page chrome: the font, the reset, and the type scale every diagram uses. */
const base = (font, width, height) => `
  @font-face { font-family: 'Geist'; src: url('${font}') format('woff2'); font-weight: 100 900; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${width}px; height: ${height}px;
    font-family: 'Geist', system-ui, sans-serif;
    background: ${C.paper}; color: ${C.ink};
    -webkit-font-smoothing: antialiased;
  }
  .caption { font-size: 15px; font-weight: 600; color: ${C.ink}; }
  .sub { font-size: 13px; color: ${C.muted}; margin-top: 2px; }
  .foot { font-size: 12px; color: ${C.faint}; }
`;

/* A barcode drawn as stripes. Nothing scannable — a scannable code in a marketing image is an
   invitation to scan it, and it would encode nothing. */
const barcode = (h = 28) => `<div style="
  height:${h}px; border-radius:1px;
  background: repeating-linear-gradient(90deg, ${C.ink} 0 2px, transparent 2px 4px, ${C.ink} 4px 5px, transparent 5px 9px, ${C.ink} 9px 12px, transparent 12px 14px);
"></div>`;

/** A redacted line of customer data, at `w` percent of the column. */
const bar = (w, h = 7) =>
	`<div style="width:${w}%;height:${h}px;border-radius:3px;background:${C.line}"></div>`;

/**
 * The shipping-label half of a Meesho page, at an arbitrary scale.
 *
 * The elements are the ones the engine actually keys on, in the positions it expects them:
 * the courier name sits directly above the "Pickup" badge (`metadataExtract.ts` anchors on that
 * badge's position rather than on a list of courier names) and the product table sits at the
 * bottom, immediately above the `TAX INVOICE` heading the boundary detector looks for.
 */
const labelBlock = (s) => `
<div style="padding:${10 * s}px;display:flex;flex-direction:column;gap:${8 * s}px;height:100%">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:${11 * s}px;font-weight:700;letter-spacing:-0.01em">Valmo</div>
      <div style="display:inline-block;margin-top:${3 * s}px;padding:${2 * s}px ${6 * s}px;border:1px solid ${C.ink};border-radius:${3 * s}px;font-size:${7 * s}px;font-weight:600">Pickup</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:${7 * s}px;color:${C.muted}">Prepaid</div>
      <div style="font-size:${9 * s}px;font-weight:700">BLR/HSR</div>
    </div>
  </div>
  ${barcode(22 * s)}
  <div style="font-size:${7 * s}px;color:${C.muted};text-align:center;letter-spacing:0.08em">AWB NUMBER</div>
  <div style="border-top:1px solid ${C.line};padding-top:${8 * s}px;display:flex;flex-direction:column;gap:${5 * s}px">
    <div style="font-size:${7 * s}px;color:${C.muted};letter-spacing:0.06em">CUSTOMER ADDRESS</div>
    ${bar(70, 6 * s)}${bar(88, 6 * s)}${bar(55, 6 * s)}
  </div>
  <div style="margin-top:auto;border:1px solid ${C.line};border-radius:${3 * s}px;overflow:hidden">
    <div style="display:flex;background:${C.wash};font-size:${7 * s}px;font-weight:700;color:${C.muted}">
      <div style="flex:2;padding:${4 * s}px ${5 * s}px">SKU</div>
      <div style="flex:1;padding:${4 * s}px ${5 * s}px">Size</div>
      <div style="flex:1;padding:${4 * s}px ${5 * s}px">Qty</div>
    </div>
    <div style="display:flex;font-size:${8 * s}px;border-top:1px solid ${C.line}">
      <div style="flex:2;padding:${4 * s}px ${5 * s}px">${bar(80, 5 * s)}</div>
      <div style="flex:1;padding:${4 * s}px ${5 * s}px">M</div>
      <div style="flex:1;padding:${4 * s}px ${5 * s}px">1</div>
    </div>
  </div>
</div>`;

/** The tax-invoice half — the part the cropper throws away. */
const invoiceBlock = (s) => `
<div style="padding:${10 * s}px;display:flex;flex-direction:column;gap:${6 * s}px;height:100%">
  <div style="font-size:${10 * s}px;font-weight:700;letter-spacing:0.04em">TAX INVOICE</div>
  <div style="display:flex;gap:${10 * s}px">
    <div style="flex:1;display:flex;flex-direction:column;gap:${4 * s}px">${bar(90, 5 * s)}${bar(70, 5 * s)}${bar(80, 5 * s)}</div>
    <div style="flex:1;display:flex;flex-direction:column;gap:${4 * s}px">${bar(75, 5 * s)}${bar(85, 5 * s)}${bar(60, 5 * s)}</div>
  </div>
  <div style="border:1px solid ${C.line};border-radius:${3 * s}px;margin-top:${2 * s}px">
    ${[1, 2, 3]
			.map(
				(i) => `<div style="display:flex;gap:${6 * s}px;padding:${5 * s}px ${6 * s}px;${i > 1 ? `border-top:1px solid ${C.line}` : ''}">
        <div style="flex:3">${bar(90, 5 * s)}</div><div style="flex:1">${bar(100, 5 * s)}</div><div style="flex:1">${bar(100, 5 * s)}</div>
      </div>`,
			)
			.join('')}
  </div>
  <div style="display:flex;justify-content:flex-end;gap:${8 * s}px;font-size:${8 * s}px;font-weight:700">
    <span style="color:${C.muted}">Total</span>${bar(18, 6 * s)}
  </div>
</div>`;

const ARROW = `<svg viewBox="0 0 48 24" style="width:48px;height:24px"><path d="M2 12h42m0 0-9-8m9 8-9 8" fill="none" stroke="${C.primary}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------------------------------------------------------------------------------------------
 * 1. Before / after — the split Meesho prints, and the label you actually want.
 * ------------------------------------------------------------------------------------------ */
function cropDiagram(font) {
	const W = 860;
	const H = 510;
	// A4 at 8.27 x 11.69in.
	const a4w = 290;
	const a4h = Math.round((a4w * 11.69) / 8.27);
	// The shipping label occupies roughly the top half of the printed page, so the cropped result
	// is *landscape*. The right-hand panel is drawn at that same aspect rather than as an upright
	// 4x6 sheet, because that is what actually comes out: `fitContainAutoRotate` rotates a landscape
	// label 90° to fill a portrait 4x6 cell, and depicting the rotation here would only puzzle the
	// reader. The caption names the printer sizes instead of implying an orientation.
	const topShare = 0.55;
	const cropw = 360;
	const croph = Math.round((cropw * a4h * topShare) / a4w);

	return `<!doctype html><html><head><meta charset="utf-8"><style>${base(font, W, H)}
    .page { border:1px solid ${C.line}; border-radius:6px; background:${C.paper}; box-shadow:0 1px 3px rgba(0,0,0,.06); overflow:hidden }
    .col { display:flex; flex-direction:column; align-items:center; gap:14px }
    .cutline { position:relative; height:0; border-top:2px dashed ${C.cut} }
    .cuttag { position:absolute; right:6px; top:-11px; background:${C.cut}; color:#fff; font-size:9px; font-weight:700; letter-spacing:.04em; padding:2px 6px; border-radius:3px }
  </style></head><body>
  <div style="height:100%;display:flex;align-items:center;justify-content:center;gap:40px;padding:26px 36px">

    <div class="col">
      <div class="page" style="width:${a4w}px;height:${a4h}px;display:flex;flex-direction:column">
        <div style="height:${topShare * 100}%">${labelBlock(1)}</div>
        <div class="cutline"><span class="cuttag">TAX INVOICE</span></div>
        <div style="flex:1;background:${C.wash}">${invoiceBlock(1)}</div>
      </div>
      <div style="text-align:center">
        <div class="caption">What Meesho gives you</div>
        <div class="sub">One A4 page: label on top, tax invoice below</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding-bottom:48px">
      ${ARROW}
      <div style="font-size:12px;font-weight:600;color:${C.primary};text-align:center;line-height:1.35">Split found<br>automatically</div>
    </div>

    <div class="col" style="padding-bottom:48px">
      <div class="page" style="width:${cropw}px;height:${croph}px;border-color:${C.primary};box-shadow:0 2px 10px rgba(43,98,239,.14)">${labelBlock(1.22)}</div>
      <div style="text-align:center">
        <div class="caption">What you print</div>
        <div class="sub">Just the label, scaled to fill 4 x 6" or 3 x 5"</div>
      </div>
    </div>

  </div></body></html>`;
}

/* ---------------------------------------------------------------------------------------------
 * 2. Printer sizes — drawn to the real geometry in `src/lib/platforms/meesho/layouts.ts`.
 * ------------------------------------------------------------------------------------------ */
function sizesDiagram(font) {
	const W = 1160;
	const H = 470;
	const PX = 30; // pixels per printed inch, shared by every figure so the comparison is honest
	const A4 = [8.27, 11.69];

	/** A miniature label: a barcode over two redacted lines. Deliberately orientation-agnostic. */
	const mini = (w, h) => {
		const pad = Math.max(2, Math.round(Math.min(w, h) * 0.08));
		return `<div style="width:100%;height:100%;background:${C.primarySoft};border:1px solid ${C.primary}33;border-radius:2px;padding:${pad}px;display:flex;flex-direction:column;gap:${pad}px;justify-content:center">
      <div style="height:${Math.max(4, h * 0.16)}px;background:repeating-linear-gradient(90deg, ${C.primary} 0 2px, transparent 2px 4px)"></div>
      <div style="height:${Math.max(2, h * 0.05)}px;width:80%;background:${C.primary}55;border-radius:2px"></div>
      <div style="height:${Math.max(2, h * 0.05)}px;width:60%;background:${C.primary}55;border-radius:2px"></div>
    </div>`;
	};

	const figures = [
		{ name: '4 x 6"', note: 'Thermal label printer', size: [4, 6], cols: 1, rows: 1, margin: 0, gap: 0 },
		{ name: '3 x 5"', note: 'Thermal label printer', size: [3, 5], cols: 1, rows: 1, margin: 0, gap: 0 },
		{ name: 'A4 — 1 up', note: 'Largest print', size: A4, cols: 1, rows: 1, margin: 0.25, gap: 0 },
		{ name: 'A4 — 2 up', note: 'Half sheet each', size: A4, cols: 1, rows: 2, margin: 0.25, gap: 0.15 },
		{ name: 'A4 — 4 up', note: 'Saves paper', size: A4, cols: 2, rows: 2, margin: 0.25, gap: 0.15 },
	];

	const figureHtml = (f) => {
		const [wIn, hIn] = f.size;
		const w = Math.round(wIn * PX);
		const h = Math.round(hIn * PX);
		const cells = Array.from({ length: f.cols * f.rows }, () => {
			const cw = (w - 2 * f.margin * PX - (f.cols - 1) * f.gap * PX) / f.cols;
			const ch = (h - 2 * f.margin * PX - (f.rows - 1) * f.gap * PX) / f.rows;
			return `<div>${mini(cw, ch)}</div>`;
		}).join('');
		return `<div style="width:${w}px;height:${h}px;border:1px solid ${C.line};border-radius:3px;background:${C.paper};box-shadow:0 1px 3px rgba(0,0,0,.06);padding:${f.margin * PX}px;display:grid;grid-template-columns:repeat(${f.cols},1fr);grid-template-rows:repeat(${f.rows},1fr);gap:${f.gap * PX}px">${cells}</div>`;
	};

	const captionHtml = (f) => `<div style="text-align:center;white-space:nowrap">
      <div class="caption">${f.name}</div>
      <div class="sub">${f.note}</div>
    </div>`;

	/* A two-row grid rather than five independent columns: the sheets sit on one baseline and the
	   captions on another, so a 4x6 and an A4 sheet cannot drift a few pixels apart. */
	return `<!doctype html><html><head><meta charset="utf-8"><style>${base(font, W, H)}</style></head><body>
    <div style="height:100%;display:flex;align-items:center;justify-content:center;padding:26px 30px">
      <div style="display:grid;grid-template-columns:repeat(${figures.length},auto);gap:14px 34px;align-items:end;justify-items:center">
        ${figures.map(figureHtml).join('')}
        ${figures.map(captionHtml).join('')}
      </div>
    </div>
  </body></html>`;
}

/* ---------------------------------------------------------------------------------------------
 * 3. Profit flow — order value, settlement, and what is left.
 * ------------------------------------------------------------------------------------------ */
function profitDiagram(font) {
	const W = 1060;
	const H = 330;
	/* Bars live in a fixed-width column and their notes in the column beside it. Sizing the bars as
	   a percentage of the whole row instead would put the 100% bar under the note text. */
	const BAR_COL = 620;

	const chips = (items, color) =>
		items
			.map(
				(t) =>
					`<span style="font-size:13px;font-weight:500;color:${color};background:${color}12;border:1px solid ${color}33;padding:6px 12px;border-radius:999px;white-space:nowrap">${t}</span>`,
			)
			.join('');

	const stage = (label, note, widthPct, fill, textColor, border) => `
    <div style="display:flex;align-items:center;gap:16px">
      <div style="width:${BAR_COL}px;flex-shrink:0">
        <div style="width:${widthPct}%;background:${fill};border:1px solid ${border};border-radius:8px;padding:12px 16px">
          <div style="font-size:15px;font-weight:700;color:${textColor};white-space:nowrap">${label}</div>
        </div>
      </div>
      <div style="font-size:13px;color:${C.muted};line-height:1.4">${note}</div>
    </div>`;

	const down = `<svg viewBox="0 0 24 40" style="width:18px;height:30px;flex-shrink:0"><path d="M12 2v32m0 0-8-9m8 9 8-9" fill="none" stroke="${C.faint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

	return `<!doctype html><html><head><meta charset="utf-8"><style>${base(font, W, H)}
    .step { display:flex; align-items:center; gap:14px; margin:7px 0 }
    .steplabel { font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; width:150px; white-space:nowrap; flex-shrink:0; text-align:right }
  </style></head><body>
  <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:26px 34px;gap:2px">

    ${stage('Order value', 'What the customer paid', 100, C.wash, C.ink, C.line)}

    <div class="step">
      <div class="steplabel" style="color:${C.cut}">Meesho subtracts</div>
      ${down}
      <div style="display:flex;flex-wrap:wrap;gap:8px">${chips(['Commission', 'Shipping charge', 'GST & TCS/TDS', 'Return & RTO charges', 'Ads spend'], C.cut)}</div>
    </div>

    ${stage('Final Settlement Amount', 'What actually reaches your bank —<br>and where the calculator starts', 66, C.primarySoft, C.primary, `${C.primary}44`)}

    <div class="step">
      <div class="steplabel" style="color:${C.muted}">Meesho can't see</div>
      ${down}
      <div style="display:flex;flex-wrap:wrap;gap:8px">${chips(['Cost of goods', 'Packaging', 'Labels & ink', 'Rent & electricity', 'Salaries', 'Stock written off'], C.muted)}</div>
    </div>

    ${stage('Your real profit', 'The number your bank balance agrees with', 38, C.goodSoft, C.good, `${C.good}44`)}

    <div class="foot" style="margin-top:14px">Bar widths are illustrative. Your own figures depend on category, parcel weight, ads and returns.</div>
  </div></body></html>`;
}

const DIAGRAMS = [
	{ slug: 'meesho-label-crop-before-after', build: cropDiagram, width: 860, height: 510 },
	{ slug: 'meesho-label-printer-sizes', build: sizesDiagram, width: 1160, height: 470 },
	{ slug: 'meesho-profit-flow', build: profitDiagram, width: 1060, height: 330 },
];

const font = await fontDataUri();
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: SCALE });

for (const d of DIAGRAMS) {
	await page.setViewportSize({ width: d.width, height: d.height });
	await page.setContent(d.build(font), { waitUntil: 'load' });
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: resolve(outDir, `${d.slug}.png`) });
	console.log(`src/assets/${d.slug}.png  (${d.width * SCALE}x${d.height * SCALE})`);
}

await browser.close();
