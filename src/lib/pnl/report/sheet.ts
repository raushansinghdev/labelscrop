/**
 * A thin drawing layer over pdf-lib, in the terms a page layout is actually thought in.
 *
 * Two things here are worth knowing before reading the report itself:
 *
 * 1. **Y grows downwards.** PDF's origin is the bottom-left corner, which means every layout
 *    calculation in a top-to-bottom document has to be written backwards. Every coordinate in
 *    this file and in `profitReport.ts` is measured from the top of the page instead, and flipped
 *    once, here, at the moment it is handed to pdf-lib.
 *
 * 2. **Text is positioned by its cap-top, not its baseline.** A card's padding is measured to the
 *    top of the letters, so that is what `top` means for `text()`. Baselines are derived.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

/** A4, in points. */
export const PAGE = { width: 595.28, height: 841.89 } as const;

/**
 * Helvetica's cap height as a share of its point size. Used to turn a cap-top into a baseline.
 */
const CAP = 0.717;

/** Rough x-height share, for vertically centring text inside a pill or an icon tile. */
const XHEIGHT = 0.523;

// ---------------------------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------------------------

export function hex(value: string): RGB {
	const h = value.replace('#', '');
	const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
	return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * `color` at `alpha` over `over`, worked out up front rather than left to PDF transparency.
 *
 * The UI's tinted cards are all `bg-success/6`-style alphas over the page. Real transparency in a
 * PDF means an ExtGState per tint, and print drivers have historically been the weak link there —
 * flattening the colour costs nothing and prints identically everywhere.
 */
export function mix(color: RGB, alpha: number, over: RGB = hex('#ffffff')): RGB {
	return rgb(
		color.red * alpha + over.red * (1 - alpha),
		color.green * alpha + over.green * (1 - alpha),
		color.blue * alpha + over.blue * (1 - alpha),
	);
}

/**
 * The light theme of `src/styles/global.css`, as hex.
 *
 * The report is always light, whatever the seller's screen is set to: it is a document that gets
 * printed, forwarded and filed, and a dark page is neither of those things. The neutrals are the
 * Tailwind steps the oklch tokens resolve to; the accents carry their hex in the stylesheet.
 */
export const COLORS = {
	foreground: hex('#0a0a0a'),
	mutedForeground: hex('#737373'),
	faint: hex('#a3a3a3'),
	border: hex('#e5e5e5'),
	muted: hex('#fafafa'),
	card: hex('#ffffff'),
	primary: hex('#2b62ef'),
	success: hex('#008135'),
	destructive: hex('#bb0916'),
	warning: hex('#975800'),
	chart1: hex('#2b62ef'),
	chart2: hex('#00a34a'),
	chart3: hex('#bb0916'),
	chart4: hex('#cb7f00'),
	chart5: hex('#0099ac'),
} as const;

/**
 * The waterfall and the donut hand their colours around as Tailwind utilities, because on screen
 * they end up as SVG `fill-*` classes. Here they have to become ink.
 */
export function fillClassToColor(className: string): RGB {
	if (className.includes('chart-1')) return COLORS.chart1;
	if (className.includes('chart-2')) return COLORS.chart2;
	if (className.includes('chart-3')) return COLORS.chart3;
	if (className.includes('chart-4')) return COLORS.chart4;
	if (className.includes('chart-5')) return COLORS.chart5;
	if (className.includes('muted-foreground/40')) return mix(COLORS.mutedForeground, 0.4);
	if (className.includes('muted-foreground')) return COLORS.mutedForeground;
	return COLORS.border;
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

/** A rounded rectangle as an SVG path, in top-down coordinates local to (0, 0). */
function roundedPath(w: number, h: number, r: number): string {
	const radius = Math.max(0, Math.min(r, w / 2, h / 2));
	if (radius === 0) return `M 0 0 H ${w} V ${h} H 0 Z`;
	const k = radius * 0.4477; // circle-from-bezier constant, as a control-point offset
	return [
		`M ${radius} 0`,
		`H ${w - radius}`,
		`C ${w - k} 0 ${w} ${k} ${w} ${radius}`,
		`V ${h - radius}`,
		`C ${w} ${h - k} ${w - k} ${h} ${w - radius} ${h}`,
		`H ${radius}`,
		`C ${k} ${h} 0 ${h - k} 0 ${h - radius}`,
		`V ${radius}`,
		`C 0 ${k} ${k} 0 ${radius} 0`,
		'Z',
	].join(' ');
}

/**
 * An arc as cubic segments, appended to a path already at its start point.
 *
 * pdf-lib's SVG parser is not the browser's, so elliptical-arc (`A`) commands are not worth
 * relying on for the one shape — the donut — that needs them. Ninety degrees at a time with the
 * standard 4/3·tan(θ/4) control offset is exact to within a rounding error at this size.
 */
function arcTo(cx: number, cy: number, r: number, from: number, to: number): string {
	const parts: string[] = [];
	const sweep = to - from;
	const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
	const step = sweep / steps;
	const k = (4 / 3) * Math.tan(step / 4);

	for (let i = 0; i < steps; i += 1) {
		const a0 = from + step * i;
		const a1 = a0 + step;
		const x0 = cx + r * Math.cos(a0);
		const y0 = cy + r * Math.sin(a0);
		const x1 = cx + r * Math.cos(a1);
		const y1 = cy + r * Math.sin(a1);
		parts.push(
			`C ${x0 - k * r * Math.sin(a0)} ${y0 + k * r * Math.cos(a0)}` +
				` ${x1 + k * r * Math.sin(a1)} ${y1 - k * r * Math.cos(a1)}` +
				` ${x1} ${y1}`,
		);
	}
	return parts.join(' ');
}

// ---------------------------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------------------------

export interface Fonts {
	regular: PDFFont;
	bold: PDFFont;
}

export type Align = 'left' | 'center' | 'right';

/** A piece of a mixed line: prose, or an amount that must not be broken across lines. */
export type Run = string | { money: number; bold?: boolean; color?: RGB; decimals?: number; suffix?: string };

export interface TextOptions {
	x: number;
	/** The top of the capital letters. */
	top: number;
	size: number;
	bold?: boolean;
	color?: RGB;
	align?: Align;
	/** Clipped with an ellipsis rather than overflowing. */
	maxWidth?: number;
	/** Extra space between characters, for the small uppercase labels. */
	tracking?: number;
}

/**
 * Everything WinAnsi — the encoding the built-in fonts use — can actually represent: printable
 * Latin-1, plus the handful of typographic extras that live in its 0x80–0x9F block.
 */
const WIN_ANSI_EXTRAS = new Set([
	0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
	0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
	0x0153, 0x017e, 0x0178,
]);

/**
 * Drops anything the font cannot encode, rather than letting it throw.
 *
 * Product names come out of the seller's own Meesho catalogue, and sellers put emoji, Devanagari
 * and typographic junk in them. `drawText` with a standard font throws on the first character it
 * cannot encode, which would turn one ™ in one product name into a report that refuses to
 * download at all. A name with a missing glyph is a far better outcome than no file.
 */
function encodable(value: string): string {
	let out = '';
	let dropped = false;
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(code)) {
			out += char;
		} else {
			dropped = true;
		}
	}
	// Untouched unless something actually went: a lone space is a legitimate string here — it is
	// how `runs` measures the gap between two words — and tidying it away closed up every
	// sentence in the report.
	if (!dropped) return value;
	const tidied = out.replace(/\s{2,}/g, ' ').trim();
	// A name written entirely in a script the font doesn't have would otherwise vanish, leaving a
	// blank cell where a product should be.
	return tidied || '?';
}

export class Sheet {
	constructor(
		readonly page: PDFPage,
		readonly fonts: Fonts,
	) {}

	private font(bold?: boolean): PDFFont {
		return bold ? this.fonts.bold : this.fonts.regular;
	}

	/** Top-down y to PDF's bottom-up y. The only place the flip happens. */
	private flip(y: number): number {
		return PAGE.height - y;
	}

	// -- shapes ---------------------------------------------------------------------------------

	rect(opts: {
		x: number;
		top: number;
		width: number;
		height: number;
		radius?: number;
		fill?: RGB;
		stroke?: RGB;
		strokeWidth?: number;
	}): void {
		const { x, top, width, height, radius = 0, fill, stroke, strokeWidth = 1 } = opts;
		if (width <= 0 || height <= 0) return;
		this.page.drawSvgPath(roundedPath(width, height, radius), {
			x,
			y: this.flip(top),
			color: fill,
			borderColor: stroke,
			borderWidth: stroke ? strokeWidth : undefined,
		});
	}

	line(opts: { x1: number; y1: number; x2: number; y2: number; color: RGB; width?: number }): void {
		this.page.drawLine({
			start: { x: opts.x1, y: this.flip(opts.y1) },
			end: { x: opts.x2, y: this.flip(opts.y2) },
			color: opts.color,
			thickness: opts.width ?? 1,
		});
	}

	circle(opts: { cx: number; cy: number; r: number; fill: RGB }): void {
		this.page.drawCircle({ x: opts.cx, y: this.flip(opts.cy), size: opts.r, color: opts.fill });
	}

	/** A filled ring segment. Angles are clockwise from twelve o'clock, as a donut is read. */
	donutSegment(opts: {
		cx: number;
		cy: number;
		outer: number;
		inner: number;
		/** Fractions of the whole circle, 0–1. */
		from: number;
		to: number;
		fill: RGB;
	}): void {
		const { cx, cy, outer, inner, fill } = opts;
		// −90° puts zero at the top; y grows downwards here, so increasing angle runs clockwise.
		const a0 = opts.from * Math.PI * 2 - Math.PI / 2;
		const a1 = opts.to * Math.PI * 2 - Math.PI / 2;
		if (a1 - a0 <= 0) return;

		const path = [
			`M ${cx + outer * Math.cos(a0)} ${cy + outer * Math.sin(a0)}`,
			arcTo(cx, cy, outer, a0, a1),
			`L ${cx + inner * Math.cos(a1)} ${cy + inner * Math.sin(a1)}`,
			arcTo(cx, cy, inner, a1, a0),
			'Z',
		].join(' ');

		this.page.drawSvgPath(path, { x: 0, y: this.flip(0), color: fill });
	}

	/**
	 * An SVG path drawn into a box, for the lucide icons borrowed from the site header.
	 *
	 * `viewBox` is the width of the square the path was authored in (24 for lucide), so an icon
	 * can be asked for at any size without its stroke weight drifting.
	 */
	icon(
		paths: readonly string[],
		opts: { x: number; top: number; size: number; color: RGB; viewBox?: number; strokeWidth?: number },
	): void {
		const scale = opts.size / (opts.viewBox ?? 24);
		for (const d of paths) {
			this.page.drawSvgPath(d, {
				x: opts.x,
				y: this.flip(opts.top),
				scale,
				borderColor: opts.color,
				borderWidth: (opts.strokeWidth ?? 2) * scale,
				borderLineCap: 1,
			});
		}
	}

	// -- text -----------------------------------------------------------------------------------

	width(text: string, size: number, bold?: boolean, tracking = 0): number {
		const safe = encodable(text);
		return this.font(bold).widthOfTextAtSize(safe, size) + tracking * Math.max(0, safe.length - 1);
	}

	/** Cuts a string to fit, with an ellipsis, the way a table cell has to. */
	clip(text: string, size: number, maxWidth: number, bold?: boolean): string {
		if (this.width(text, size, bold) <= maxWidth) return text;
		let out = text;
		while (out.length > 1 && this.width(`${out}…`, size, bold) > maxWidth) out = out.slice(0, -1);
		return `${out}…`;
	}

	/** Greedy word wrap. Returns at most `maxLines`, the last one clipped. */
	wrap(text: string, size: number, maxWidth: number, maxLines = 99, bold?: boolean): string[] {
		const words = text.split(/\s+/).filter(Boolean);
		const lines: string[] = [];
		let line = '';
		for (const word of words) {
			const next = line ? `${line} ${word}` : word;
			if (this.width(next, size, bold) <= maxWidth || !line) {
				line = next;
			} else {
				lines.push(line);
				line = word;
				if (lines.length === maxLines) break;
			}
		}
		if (lines.length < maxLines && line) lines.push(line);
		if (lines.length === maxLines) lines[maxLines - 1] = this.clip(lines[maxLines - 1], size, maxWidth, bold);
		return lines;
	}

	/** Draws one line of text and returns the width it took. */
	text(value: string, opts: TextOptions): number {
		const { x, top, size, bold, color = COLORS.foreground, align = 'left', maxWidth, tracking = 0 } = opts;
		const string = encodable(maxWidth ? this.clip(value, size, maxWidth, bold) : value);
		const w = this.width(string, size, bold, tracking);
		const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;

		this.page.drawText(string, {
			x: left,
			y: this.flip(top + size * CAP),
			size,
			font: this.font(bold),
			color,
			...(tracking ? { characterSpacing: tracking } : {}),
		});
		return w;
	}

	/** Several wrapped lines from one top, returning the y just past the last of them. */
	paragraph(
		value: string,
		opts: TextOptions & { maxWidth: number; lineHeight?: number; maxLines?: number },
	): number {
		const lineHeight = opts.lineHeight ?? opts.size * 1.35;
		const lines = this.wrap(value, opts.size, opts.maxWidth, opts.maxLines ?? 99, opts.bold);
		lines.forEach((line, i) => {
			this.text(line, { ...opts, top: opts.top + i * lineHeight, maxWidth: undefined });
		});
		return opts.top + Math.max(0, lines.length - 1) * lineHeight + opts.size * CAP;
	}

	// -- money ----------------------------------------------------------------------------------

	/**
	 * Amounts are printed as bare grouped digits — "1,28,952", not "₹1,28,952".
	 *
	 * ₹ is U+20B9, which arrived long after the fourteen fonts every PDF reader is required to
	 * carry: Helvetica cannot encode it, and neither can any of the others. Drawing the glyph as
	 * vector paths was tried, and a hand-drawn sign standing next to real type looks exactly as
	 * convincing as that sounds; embedding a Unicode font would cost a few hundred kilobytes on
	 * every download for one character. So the report does what every printed financial statement
	 * does instead — names the currency once per page, in the masthead and the footer — and leaves
	 * the columns as clean digits.
	 */
	moneyWidth(value: number, size: number, bold?: boolean, decimals = 0): number {
		const { sign, digits } = splitMoney(value, decimals);
		return this.width(sign + digits, size, bold);
	}

	money(
		value: number,
		opts: { x: number; top: number; size: number; bold?: boolean; color?: RGB; align?: Align; decimals?: number },
	): number {
		const { sign, digits } = splitMoney(value, opts.decimals ?? 0);
		return this.text(sign + digits, {
			x: opts.x,
			top: opts.top,
			size: opts.size,
			bold: opts.bold,
			color: opts.color,
			align: opts.align,
		});
	}

	/**
	 * A sentence with amounts inside it.
	 *
	 * Laid out as a row of tokens — words from the prose, plus each amount as one token — and
	 * wrapped the way a word wrap would. An amount is atomic, so "1,28,952" can never be broken
	 * across two lines, and it can carry its own weight and colour inside an otherwise grey line.
	 */
	runs(
		parts: Run[],
		opts: { x: number; top: number; size: number; color?: RGB; bold?: boolean; maxWidth: number; lineHeight?: number; maxLines?: number },
	): number {
		const { x, top, size, color = COLORS.foreground, bold, maxWidth } = opts;
		const lineHeight = opts.lineHeight ?? size * 1.35;
		const maxLines = opts.maxLines ?? 99;
		const space = this.width(' ', size, bold);

		type Token = { width: number; draw: (x: number, top: number) => void };
		const tokens: Token[] = [];
		for (const part of parts) {
			if (typeof part === 'string') {
				for (const word of part.split(/\s+/).filter(Boolean)) {
					tokens.push({
						width: this.width(word, size, bold),
						draw: (tx, ty) => void this.text(word, { x: tx, top: ty, size, bold, color }),
					});
				}
			} else {
				const runBold = part.bold ?? bold;
				const runColor = part.color ?? color;
				const suffix = part.suffix ?? '';
				tokens.push({
					width: this.moneyWidth(part.money, size, runBold, part.decimals) + this.width(suffix, size, runBold),
					draw: (tx, ty) => {
						const w = this.money(part.money, { x: tx, top: ty, size, bold: runBold, color: runColor, decimals: part.decimals });
						if (suffix) this.text(suffix, { x: tx + w, top: ty, size, bold: runBold, color: runColor });
					},
				});
			}
		}

		let line: Token[] = [];
		let lineWidth = 0;
		let y = top;
		let drawn = 0;

		const flush = () => {
			let cursor = x;
			for (const token of line) {
				token.draw(cursor, y);
				cursor += token.width + space;
			}
			drawn += 1;
			y += lineHeight;
			line = [];
			lineWidth = 0;
		};

		for (const token of tokens) {
			const next = lineWidth === 0 ? token.width : lineWidth + space + token.width;
			if (next > maxWidth && line.length > 0) {
				flush();
				if (drawn >= maxLines) return y - lineHeight + size * CAP;
			}
			line.push(token);
			lineWidth = lineWidth === 0 ? token.width : lineWidth + space + token.width;
		}
		if (line.length > 0) flush();

		return y - lineHeight + size * CAP;
	}

	/** A pill — the margin chip, the "N orders" badge on a chart card. */
	pill(opts: {
		x: number;
		top: number;
		height: number;
		label: string;
		size: number;
		fill: RGB;
		color: RGB;
		bold?: boolean;
		padding?: number;
	}): number {
		const padding = opts.padding ?? opts.size * 0.75;
		const width = this.width(opts.label, opts.size, opts.bold) + padding * 2;
		this.rect({
			x: opts.x,
			top: opts.top,
			width,
			height: opts.height,
			radius: opts.height / 2,
			fill: opts.fill,
		});
		this.text(opts.label, {
			x: opts.x + padding,
			top: opts.top + (opts.height - opts.size * XHEIGHT) / 2 - opts.size * (CAP - XHEIGHT),
			size: opts.size,
			bold: opts.bold,
			color: opts.color,
		});
		return width;
	}
}

/** Indian digit grouping, and the minus kept separate so it can be measured with the digits. */
function splitMoney(value: number, decimals: number): { sign: string; digits: string } {
	const safe = Number.isFinite(value) ? value : 0;
	// −0 reads as a loss of nothing, which is a strange thing to print.
	const rounded = Math.abs(safe) < 0.5 / 10 ** decimals ? 0 : safe;
	const digits = new Intl.NumberFormat('en-IN', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(Math.abs(rounded));
	return { sign: rounded < 0 ? '-' : '', digits };
}

export async function createDocument(): Promise<{ doc: PDFDocument; fonts: Fonts }> {
	const doc = await PDFDocument.create();
	return {
		doc,
		fonts: {
			regular: await doc.embedFont(StandardFonts.Helvetica),
			bold: await doc.embedFont(StandardFonts.HelveticaBold),
		},
	};
}
