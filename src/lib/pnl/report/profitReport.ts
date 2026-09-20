/**
 * The profit overview, as a PDF a seller can file, print or forward to their accountant.
 *
 * It is drawn rather than screenshotted. A rasterised copy of the dashboard would be a megabyte
 * of pixels that blur when printed and cannot be searched; this is a few dozen kilobytes of
 * vectors and real text, laid out to the same shapes and the same palette as the screen it came
 * from so that the two are recognisably one thing. Everything runs in the browser — the payment
 * file never leaves the machine, which is the promise the rest of the tool makes too.
 *
 * The numbers are not recomputed here. They come from `deriveOverview` / `deriveInsights` and
 * `buildWaterfall`, the same functions the dashboard renders from, so a downloaded report cannot
 * quietly disagree with the screen.
 */

import { deriveInsights, deriveOverview } from '@/components/pnl/derive';
import { buildWaterfall, niceAxis } from '@/components/pnl/charts/waterfall';
import { prorate } from '@/components/pnl/expenses';
import { formatDateRange, formatNumber, formatPercent } from '@/components/pnl/format';
import { buildStatusSlices } from '@/components/pnl/status';
import type { ExpenseRow } from '@/components/pnl/expenses';
import type { LossRates, PnlResult, SkuRow } from '@/components/pnl/types';
import { ICONS } from './icons';
import { COLORS, PAGE, Sheet, createDocument, fillClassToColor, formatMoney, mix, type Fonts, type Run } from './sheet';
import type { PDFDocument, RGB } from 'pdf-lib';

export interface ProfitReportInput {
	result: PnlResult;
	/** Fixed business expenses for this period, already prorated. */
	overheads: number;
	expenses: ExpenseRow[];
	/** Days the payment window covers, which is what the expenses were prorated against. */
	expenseDays: number;
	/** The payment files this was built from, named on the cover so the report is traceable. */
	fileNames: string[];
	generatedAt?: Date;
}

const M = 36;
const CONTENT = PAGE.width - M * 2;
const FOOTER_TOP = PAGE.height - 46;
/** Nothing is drawn below this; a section that would cross it starts a new page. */
const PAGE_BOTTOM = FOOTER_TOP - 14;

export async function buildProfitReportPdf(input: ProfitReportInput): Promise<Uint8Array> {
	const { doc, fonts } = await createDocument();
	const report = new Report(doc, fonts, input);
	report.draw();
	report.stampFooters();
	return doc.save();
}

class Report {
	private sheets: Sheet[] = [];
	private sheet!: Sheet;
	private readonly generatedAt: Date;

	constructor(
		private readonly doc: PDFDocument,
		private readonly fonts: Fonts,
		private readonly input: ProfitReportInput,
	) {
		this.generatedAt = input.generatedAt ?? new Date();
		this.newPage();
	}

	private newPage(): Sheet {
		this.sheet = new Sheet(this.doc.addPage([PAGE.width, PAGE.height]), this.fonts);
		this.sheets.push(this.sheet);
		return this.sheet;
	}

	draw(): void {
		const { result, overheads } = this.input;
		const figures = deriveOverview(result.overall, overheads);

		let y = this.drawMasthead(M);
		y = this.drawHeadline(y + 16, figures);
		y = this.drawTiles(y + 12);
		// Same order as the dashboard: the warning about missing costs belongs directly under the
		// figures it undermines, not at the foot of the page.
		y = this.drawWarnings(y + 10);
		y = this.drawInsights(y + 12);
		this.drawCharts(y + 12);
		// The products table always opens a fresh page. It runs to several pages on a real file,
		// and three rows squeezed under the charts would be a worse first impression than a clean
		// one-page overview followed by the detail.
		y = this.drawProducts(PAGE_BOTTOM);
		this.drawAssumptions(y + 24);
	}

	// -- page furniture -------------------------------------------------------------------------

	/** The brand, the title and what the figures cover. Repeated, smaller, on later pages. */
	private drawMasthead(top: number): number {
		const s = this.sheet;
		const { result, fileNames } = this.input;
		const { overall } = result;

		s.rect({ x: M, top, width: 22, height: 22, radius: 7, fill: COLORS.primary });
		s.icon(ICONS.logo, { x: M + 5, top: top + 5, size: 12, color: COLORS.card, strokeWidth: 2 });
		s.text('LabelsCrop', { x: M + 30, top: top + 6, size: 12, bold: true });

		s.text(`Generated ${longDate(this.generatedAt)}`, {
			x: PAGE.width - M,
			top: top + 7,
			size: 8,
			color: COLORS.mutedForeground,
			align: 'right',
		});

		s.text('Profit overview', { x: M, top: top + 38, size: 21, bold: true });
		// The rupee sign cannot be typed in a PDF's built-in fonts, so the report states its
		// currency the way a printed statement does, and prints amounts as plain digits.
		s.text('All amounts in INR', {
			x: PAGE.width - M,
			top: top + 45,
			size: 8,
			color: COLORS.mutedForeground,
			align: 'right',
		});

		const period = formatDateRange(overall.payment_window_start, overall.payment_window_end);
		const source = fileNames.length === 1 ? fileNames[0] : `${fileNames.length} payment files`;
		const facts = [
			period || 'Payment period',
			`${formatNumber(overall.total_orders)} orders`,
			`${formatNumber(result.sku_rows.length)} products`,
			source,
		];
		s.text(facts.join('   ·   '), {
			x: M,
			top: top + 68,
			size: 8.5,
			color: COLORS.mutedForeground,
			maxWidth: CONTENT,
		});

		const rule = top + 86;
		s.line({ x1: M, y1: rule, x2: PAGE.width - M, y2: rule, color: COLORS.border });
		return rule;
	}

	/** Later pages get a one-line version, so a printed sheet that gets separated still says what it is. */
	private drawRunningHead(top: number, label: string): number {
		const s = this.sheet;
		s.rect({ x: M, top, width: 14, height: 14, radius: 4.5, fill: COLORS.primary });
		s.icon(ICONS.logo, { x: M + 3, top: top + 3, size: 8, color: COLORS.card, strokeWidth: 2.4 });
		s.text('LabelsCrop', { x: M + 20, top: top + 3.5, size: 8.5, bold: true });
		s.text(label, {
			x: PAGE.width - M,
			top: top + 3.5,
			size: 8.5,
			color: COLORS.mutedForeground,
			align: 'right',
		});
		const rule = top + 22;
		s.line({ x1: M, y1: rule, x2: PAGE.width - M, y2: rule, color: COLORS.border });
		return rule;
	}

	/** Page numbers and the standing note, added once every page exists. */
	stampFooters(): void {
		const total = this.sheets.length;
		this.sheets.forEach((s, index) => {
			s.line({ x1: M, y1: FOOTER_TOP, x2: PAGE.width - M, y2: FOOTER_TOP, color: COLORS.border });
			s.text('Built from your Meesho payment file with your own costs. All amounts in INR. labelscrop.com', {
				x: M,
				top: FOOTER_TOP + 10,
				size: 7.5,
				color: COLORS.faint,
			});
			s.text(`Page ${index + 1} of ${total}`, {
				x: PAGE.width - M,
				top: FOOTER_TOP + 10,
				size: 7.5,
				color: COLORS.faint,
				align: 'right',
			});
		});
	}

	/** Starts a new page when `height` would not fit, and returns the top to draw from. */
	private fit(top: number, height: number, label: string): number {
		if (top + height <= PAGE_BOTTOM) return top;
		this.newPage();
		return this.drawRunningHead(M, label) + 16;
	}

	// -- the headline ---------------------------------------------------------------------------

	private drawHeadline(top: number, f: ReturnType<typeof deriveOverview>): number {
		const s = this.sheet;
		const { overall } = this.input.result;
		const { overheads } = this.input;

		const tone = f.positive ? COLORS.success : COLORS.destructive;
		const height = 118;
		const pad = 15;

		s.rect({
			x: M,
			top,
			width: CONTENT,
			height,
			radius: 14,
			fill: mix(tone, 0.06),
			stroke: mix(tone, 0.25),
			strokeWidth: 0.8,
		});

		const statsWidth = 152;
		const leftWidth = CONTENT - pad * 2 - statsWidth - 16;
		let y = top + pad;

		s.text('Net profit', { x: M + pad, top: y + 1.5, size: 9, color: COLORS.mutedForeground });
		const chipX = M + pad + s.width('Net profit', 9) + 8;
		s.pill({
			x: chipX,
			top: y - 2.5,
			height: 15,
			label: `${formatPercent(f.marginPct)} margin`,
			size: 8.5,
			bold: true,
			fill: mix(tone, 0.15),
			color: tone,
		});

		y += 15;
		s.money(f.realProfit, { x: M + pad, top: y, size: 30, bold: true, color: tone });

		y += 33;
		const sentence: Run[] = [
			'kept from',
			{ money: overall.net_settlement },
			`of settlement across ${formatNumber(overall.total_orders)} orders`,
		];
		if (overheads > 0) {
			sentence[2] = `${sentence[2] as string}, after`;
			sentence.push({ money: overheads }, 'of business expenses');
		}
		y = s.runs(sentence, {
			x: M + pad,
			top: y,
			size: 8.5,
			color: COLORS.mutedForeground,
			maxWidth: leftWidth,
			lineHeight: 12,
			maxLines: 2,
		});

		// How much of the payout survived to profit, as a bar. The percentage above says the same
		// thing, but a bar is read without arithmetic.
		y += 12;
		const share = Math.max(0, Math.min(1, f.profitShare));
		s.rect({ x: M + pad, top: y, width: leftWidth, height: 6, radius: 3, fill: mix(COLORS.foreground, 0.1) });
		if (share > 0) {
			s.rect({ x: M + pad, top: y, width: Math.max(3, leftWidth * share), height: 6, radius: 3, fill: tone });
		}
		s.text(
			f.positive
				? 'Share of your payout that stayed with you.'
				: 'You paid out more than you were settled for this period.',
			{ x: M + pad, top: y + 13, size: 8, color: COLORS.mutedForeground, maxWidth: leftWidth },
		);

		// Two figures nothing else on the page shows: what one parcel is worth, and what Meesho
		// charged for the ones that came back.
		const statsX = M + CONTENT - pad - statsWidth;
		const statsTop = top + pad;
		const statsHeight = height - pad * 2;
		s.rect({
			x: statsX,
			top: statsTop,
			width: statsWidth,
			height: statsHeight,
			radius: 9,
			fill: COLORS.card,
			stroke: mix(tone, 0.2),
			strokeWidth: 0.8,
		});
		s.line({
			x1: statsX,
			y1: statsTop + statsHeight / 2,
			x2: statsX + statsWidth,
			y2: statsTop + statsHeight / 2,
			color: mix(tone, 0.2),
			width: 0.8,
		});
		this.miniStat(statsX, statsTop, statsWidth, statsHeight / 2, 'PER ORDER', f.perOrder, tone);
		this.miniStat(
			statsX,
			statsTop + statsHeight / 2,
			statsWidth,
			statsHeight / 2,
			'RETURN FEE',
			f.returnFee,
			COLORS.foreground,
		);

		return top + height;
	}

	private miniStat(x: number, top: number, width: number, height: number, label: string, value: number, color: RGB): void {
		const s = this.sheet;
		s.text(label, {
			x: x + 12,
			top: top + height / 2 - 14,
			size: 7,
			bold: true,
			color: COLORS.mutedForeground,
			tracking: 0.5,
			maxWidth: width - 24,
		});
		s.money(value, { x: x + 12, top: top + height / 2 - 1, size: 14, bold: true, color });
	}

	// -- the five tiles -------------------------------------------------------------------------

	private drawTiles(top: number): number {
		const s = this.sheet;
		const { overall } = this.input.result;
		const { overheads } = this.input;

		const tiles: { label: string; value: number; hint: Run[]; currency: boolean; icon: readonly string[] }[] = [
			{
				label: 'Settlement',
				icon: ICONS.banknote,
				value: overall.net_settlement,
				hint: ['What Meesho actually paid out'],
				currency: true,
			},
			{
				label: 'Cost of goods',
				icon: ICONS.package,
				value: overall.cogs,
				hint: ['Making', { money: overall.cogs_making }, '· Packing', { money: overall.cogs_packaging }],
				currency: true,
			},
			{
				label: 'Ads spend',
				icon: ICONS.megaphone,
				value: overall.ads_cost,
				hint: ['Account-level, not per SKU'],
				currency: true,
			},
			{
				label: 'Business expenses',
				icon: ICONS.building,
				value: -overheads,
				hint: [overheads > 0 ? 'Rent, salary and bills for this period' : 'Not set — add them in Expenses'],
				currency: true,
			},
			{
				label: 'Orders',
				icon: ICONS.shoppingBag,
				value: overall.total_orders,
				hint: [`${formatNumber(overall.total_units)} units in them`],
				currency: false,
			},
		];

		const gap = 8;
		const width = (CONTENT - gap * (tiles.length - 1)) / tiles.length;
		const height = 64;

		tiles.forEach((tile, i) => {
			const x = M + i * (width + gap);
			s.rect({ x, top, width, height, radius: 9, fill: COLORS.card, stroke: COLORS.border, strokeWidth: 0.8 });
			s.icon(tile.icon, { x: x + 10, top: top + 8.5, size: 9, color: COLORS.mutedForeground, strokeWidth: 2 });
			s.text(tile.label, {
				x: x + 22,
				top: top + 10,
				size: 7.5,
				color: COLORS.mutedForeground,
				maxWidth: width - 31,
			});
			if (tile.currency) {
				s.money(tile.value, { x: x + 10, top: top + 22, size: 13.5, bold: true });
			} else {
				s.text(formatNumber(tile.value), { x: x + 10, top: top + 22, size: 13.5, bold: true });
			}
			s.runs(tile.hint, {
				x: x + 10,
				top: top + 41,
				size: 7,
				color: COLORS.mutedForeground,
				maxWidth: width - 20,
				lineHeight: 9,
				maxLines: 2,
			});
		});

		return top + height;
	}

	// -- best, worst, returns -------------------------------------------------------------------

	private drawInsights(top: number): number {
		const insights = deriveInsights(this.input.result);
		if (!insights) return top;

		const s = this.sheet;
		const { overall } = this.input.result;
		const { best, drain, worst, losers, returnRate, returnedOrders, returnCost } = insights;

		const cards: {
			label: string;
			/** An amount, or the "no loss-makers" answer in words. */
			value: number | string;
			detail: string;
			hint: Run[];
			tone: RGB;
			icon: readonly string[];
		}[] = [
			{
				label: 'Best earner',
				icon: ICONS.trophy,
				value: best.profit,
				detail: best.sku,
				hint: [`${formatNumber(best.orders)} orders · this SKU is carrying you`],
				tone: COLORS.success,
			},
			drain
				? {
						label: 'Losing you money',
						icon: ICONS.trendingDown,
						value: drain.profit,
						detail: drain.sku,
						hint: [
							losers > 1
								? `${formatNumber(losers)} SKUs are in the red`
								: `${formatNumber(drain.orders)} orders, all at a loss`,
						],
						tone: COLORS.destructive,
					}
				: {
						label: 'Losing you money',
						icon: ICONS.trendingDown,
						value: 'None',
						detail: 'Every SKU earns',
						hint: [`Thinnest is ${worst.sku} at`, { money: worst.profit }],
						tone: COLORS.success,
					},
			{
				label: 'Returns cost you',
				icon: ICONS.rotateCcw,
				value: returnCost,
				detail: `${returnRate.toFixed(0)}% came back`,
				hint: [
					`${formatNumber(returnedOrders)} of ${formatNumber(overall.total_orders)} orders · stock and packaging written off`,
				],
				tone: returnRate >= 20 ? COLORS.destructive : COLORS.chart4,
			},
		];

		const gap = 10;
		const width = (CONTENT - gap * 2) / 3;
		const height = 62;

		cards.forEach((card, i) => {
			const x = M + i * (width + gap);
			s.rect({ x, top, width, height, radius: 9, fill: COLORS.card, stroke: COLORS.border, strokeWidth: 0.8 });
			s.rect({ x: x + 10, top: top + 11, width: 18, height: 18, radius: 5, fill: mix(card.tone, 0.12) });
			s.icon(card.icon, { x: x + 14.5, top: top + 15.5, size: 9, color: card.tone, strokeWidth: 2.2 });

			const textX = x + 36;
			const textW = width - 46;
			s.text(card.label, { x: textX, top: top + 11, size: 7.5, color: COLORS.mutedForeground, maxWidth: textW });
			const valueW =
				typeof card.value === 'number'
					? s.money(card.value, { x: textX, top: top + 22, size: 12.5, bold: true, color: card.tone })
					: s.text(card.value, { x: textX, top: top + 22, size: 12.5, bold: true, color: card.tone });
			s.text(card.detail, {
				x: textX + valueW + 5,
				top: top + 25,
				size: 7.5,
				color: COLORS.mutedForeground,
				maxWidth: Math.max(10, textW - valueW - 5),
			});
			s.runs(card.hint, {
				x: textX,
				top: top + 40,
				size: 7,
				color: COLORS.mutedForeground,
				maxWidth: textW,
				lineHeight: 9,
				maxLines: 2,
			});
		});

		return top + height;
	}

	// -- charts ---------------------------------------------------------------------------------

	private drawCharts(top: number): number {
		// Stretched to the foot of the page rather than fixed: the two cards are the only thing
		// below the insight row, so leaving 90 points of white under them reads as a page that
		// ran out rather than one that was laid out.
		const height = Math.max(232, PAGE_BOTTOM - top);
		const gap = 10;
		const donutWidth = 186;
		const waterfallWidth = CONTENT - donutWidth - gap;

		this.drawDonut(M, top, donutWidth, height);
		this.drawWaterfall(M + donutWidth + gap, top, waterfallWidth, height);
		return top + height;
	}

	/** The shell every chart sits in: title, caption, a count on the right. */
	private chartCard(
		x: number,
		top: number,
		width: number,
		height: number,
		title: string,
		caption: string,
		/** The one figure the card resolves to, named — "707 orders", "Net 58". */
		badge: string,
	): number {
		const s = this.sheet;
		s.rect({ x, top, width, height, radius: 12, fill: COLORS.card, stroke: COLORS.border, strokeWidth: 0.8 });
		const badgeW = s.width(badge, 7.5);
		s.text(title, { x: x + 14, top: top + 14, size: 10.5, bold: true, maxWidth: width - 28 - badgeW - 8 });
		s.text(badge, { x: x + width - 14, top: top + 15, size: 7.5, color: COLORS.mutedForeground, align: 'right' });
		return s.paragraph(caption, {
			x: x + 14,
			top: top + 29,
			size: 7.5,
			color: COLORS.mutedForeground,
			maxWidth: width - 28,
			lineHeight: 10,
			maxLines: 2,
		});
	}

	private drawDonut(x: number, top: number, width: number, height: number): void {
		const s = this.sheet;
		const { slices, total } = buildStatusSlices(this.input.result.status_breakdown);
		const afterCaption = this.chartCard(
			x,
			top,
			width,
			height,
			'How orders ended up',
			'Deliveries earn; returns cost you the packaging and often the item too.',
			`${formatNumber(total)} orders`,
		);

		if (total === 0) return;

		// The card is as tall as the page has room for, so the ring is sized to what is left over
		// after the legend and then the pair is centred in it — rather than pinned under the
		// caption with the slack collecting at the bottom.
		const bodyTop = afterCaption + 12;
		const bodyBottom = top + height - 16;
		const legendGap = 16;
		const legendHeight = slices.length * 13;
		const outer = clamp((bodyBottom - bodyTop - legendHeight - legendGap) / 2, 30, width / 2 - 24);
		const inner = outer * 0.65;
		const blockHeight = outer * 2 + legendGap + legendHeight;
		const cx = x + width / 2;
		const cy = bodyTop + Math.max(0, (bodyBottom - bodyTop - blockHeight) / 2) + outer;

		let cursor = 0;
		for (const slice of slices) {
			const fraction = slice.value / total;
			if (fraction <= 0) continue;
			// A hairline gap in the card colour is what separates touching slices — the same
			// 1.5° padding angle the screen uses, expressed as a fraction of the circle.
			const pad = slices.length > 1 ? 0.004 : 0;
			s.donutSegment({
				cx,
				cy,
				outer,
				inner,
				from: cursor + pad / 2,
				to: cursor + fraction - pad / 2,
				fill: fillClassToColor(slice.fill),
			});
			cursor += fraction;
		}

		const centreSize = clamp(outer * 0.4, 12, 20);
		s.text(formatNumber(total), { x: cx, top: cy - centreSize * 0.62, size: centreSize, bold: true, align: 'center' });
		s.text('ORDERS', {
			x: cx,
			top: cy + centreSize * 0.36,
			size: 6.5,
			bold: true,
			color: COLORS.mutedForeground,
			align: 'center',
			tracking: 0.6,
		});

		// The legend is the accessible channel: every slice is named and counted, so the ring
		// never has to be read by colour alone.
		let legendTop = cy + outer + legendGap;
		for (const slice of slices) {
			s.circle({ cx: x + 17, cy: legendTop + 3, r: 2.6, fill: fillClassToColor(slice.fill) });
			const right = `${formatNumber(slice.value)} · ${slice.percentage.toFixed(0)}%`;
            const rightW = s.width(right, 7.5);
			s.text(slice.name, { x: x + 25, top: legendTop, size: 7.5, maxWidth: width - 39 - rightW - 6 });
			s.text(right, {
				x: x + width - 14,
				top: legendTop,
				size: 7.5,
				color: COLORS.mutedForeground,
				align: 'right',
			});
			legendTop += 13;
		}
	}

	private drawWaterfall(x: number, top: number, width: number, height: number): void {
		const s = this.sheet;
		const { overall } = this.input.result;
		const bars = buildWaterfall(overall, this.input.overheads);
		const net = overall.net_profit - this.input.overheads;

		const afterCaption = this.chartCard(
			x,
			top,
			width,
			height,
			'Where the money went',
			'Start at what Meesho paid you, subtract every cost, and land on what you actually kept.',
			`Net ${formatMoney(net)}`,
		);

		const labelWidth = 62;
		const valueWidth = 52;
		const plotX = x + 14 + labelWidth + 6;
		const plotW = width - 28 - labelWidth - 6 - valueWidth - 6;
		const plotTop = afterCaption + 12;
		const plotBottom = top + height - 16;
		const rowHeight = (plotBottom - plotTop) / bars.length;
		const barHeight = Math.min(9, rowHeight - 4);

		const lows = bars.map((b) => Math.min(b.range[0], b.range[1]));
		const highs = bars.map((b) => Math.max(b.range[0], b.range[1]));
		const axis = niceAxis(Math.min(0, ...lows), Math.max(0, ...highs), 4);
		const [domainLow, domainHigh] = axis.domain;
		const span = domainHigh - domainLow || 1;
		const toX = (value: number) => plotX + ((value - domainLow) / span) * plotW;

		// A single rule at zero, which is what every bar is read against. Chart gridlines at every
		// tick would be ink competing with nine short bars for the same 150 points of width.
		const zeroX = toX(0);
		s.line({ x1: zeroX, y1: plotTop - 4, x2: zeroX, y2: plotBottom, color: COLORS.border, width: 0.8 });

		bars.forEach((bar, i) => {
			const rowTop = plotTop + i * rowHeight;
			const barTop = rowTop + (rowHeight - barHeight) / 2;
			const from = toX(bar.range[0]);
			const to = toX(bar.range[1]);
			const left = Math.min(from, to);
			const barWidth = Math.max(1, Math.abs(to - from));

			s.text(bar.name, {
				x: x + 14 + labelWidth,
				top: barTop + 1,
				size: 7,
				color: COLORS.mutedForeground,
				align: 'right',
				maxWidth: labelWidth,
			});
			s.rect({ x: left, top: barTop, width: barWidth, height: barHeight, radius: 2, fill: fillClassToColor(bar.className) });

			// The figure sits at the end the bar grew towards, so the eye follows the bar to it —
			// unless that end is too near the edge of the plot to hold it, in which case it goes
			// on the other side rather than over the label gutter or off the card.
			const valueW = s.moneyWidth(bar.delta, 7);
			const outside = bar.delta < 0 ? left - 4 - valueW : left + barWidth + 4;
			const fitsOutside = bar.delta < 0 ? outside >= plotX - 2 : outside + valueW <= plotX + plotW + valueWidth;
			const valueX = fitsOutside
				? outside
				: bar.delta < 0
					? left + barWidth + 4
					: Math.max(plotX, left - 4 - valueW);
			s.money(bar.delta, {
				x: valueX,
				top: barTop + 1,
				size: 7,
				color: COLORS.mutedForeground,
			});
		});
	}

	// -- what the seller still has to fix -------------------------------------------------------

	private drawWarnings(top: number): number {
		const { unmapped_skus } = this.input.result;
		if (unmapped_skus.length === 0) return top;

		const height = 34;
		// After `fit`, not before: it may have started a new page, and `this.sheet` is what moved.
		const y = this.fit(top, height, 'Profit overview');
		const s = this.sheet;
		s.rect({
			x: M,
			top: y,
			width: CONTENT,
			height,
			radius: 9,
			fill: mix(COLORS.chart4, 0.1),
			stroke: mix(COLORS.chart4, 0.3),
			strokeWidth: 0.8,
		});
		s.circle({ cx: M + 18, cy: y + height / 2, r: 5, fill: COLORS.chart4 });
		s.text(
			`${formatNumber(unmapped_skus.length)} ${unmapped_skus.length === 1 ? 'product has' : 'products have'} no cost recorded`,
			{ x: M + 32, top: y + 9, size: 8.5, bold: true, maxWidth: CONTENT - 46 },
		);
		s.text('The profit above is overstated until you add them in the Costs tab.', {
			x: M + 32,
			top: y + 20,
			size: 7.5,
			color: COLORS.mutedForeground,
			maxWidth: CONTENT - 46,
		});
		return y + height;
	}

	// -- every product --------------------------------------------------------------------------

	private drawProducts(top: number): number {
		const rows = [...this.input.result.sku_rows].sort((a, b) => b.profit - a.profit);
		if (rows.length === 0) return top;

		const headerHeight = 30;
		// A table that can only fit its heading and a row or two at the foot of a page is worse
		// than one that starts clean overleaf.
		let y = this.fit(top, headerHeight + 60, 'Every product');
		const s = this.sheet;

		s.text('Every product', { x: M, top: y, size: 12, bold: true });
		s.text(
			`${formatNumber(rows.length)} SKUs, best first, all amounts in INR. Profit is after this SKU's own making and packing cost, before ads and business expenses.`,
			{ x: M, top: y + 16, size: 7.5, color: COLORS.mutedForeground, maxWidth: CONTENT },
		);
		y += headerHeight;

		const columns = this.productColumns();
		y = this.drawTableHead(y, columns);

		const rowHeight = 15;
		for (const [index, row] of rows.entries()) {
			if (y + rowHeight > PAGE_BOTTOM) {
				this.newPage();
				y = this.drawRunningHead(M, 'Every product') + 16;
				y = this.drawTableHead(y, columns);
			}
			this.drawProductRow(y, rowHeight, columns, row, index);
			y += rowHeight;
		}
		return y;
	}

	private productColumns(): Column[] {
		// Right-aligned numbers, left-aligned names: a column of figures is compared by its digits
		// lining up, which is the whole reason a table beats nine cards here.
		const numeric = [
			{ key: 'orders', label: 'Orders', width: 38 },
			{ key: 'units', label: 'Units', width: 34 },
			{ key: 'delivered', label: 'Delivered', width: 44 },
			{ key: 'returned', label: 'Returned', width: 44 },
			{ key: 'settlement', label: 'Settlement', width: 62 },
			{ key: 'cogs', label: 'Item cost', width: 56 },
			{ key: 'profit', label: 'Profit', width: 58 },
			{ key: 'margin', label: 'Margin', width: 40 },
		] as const;
		const used = numeric.reduce((sum, c) => sum + c.width, 0);
		return [{ key: 'sku', label: 'Product', width: CONTENT - used, align: 'left' }, ...numeric.map((c) => ({ ...c, align: 'right' as const }))];
	}

	private drawTableHead(top: number, columns: Column[]): number {
		const s = this.sheet;
		let x = M;
		for (const column of columns) {
			s.text(column.label, {
				x: column.align === 'right' ? x + column.width : x,
				top: top + 3,
				size: 6.5,
				bold: true,
				color: COLORS.mutedForeground,
				align: column.align,
				tracking: 0.3,
				maxWidth: column.width,
			});
			x += column.width;
		}
		s.line({ x1: M, y1: top + 14, x2: PAGE.width - M, y2: top + 14, color: COLORS.border });
		return top + 18;
	}

	private drawProductRow(top: number, height: number, columns: Column[], row: SkuRow, index: number): void {
		const s = this.sheet;
		// Banded rather than ruled: nine columns of small figures need the eye held on one line,
		// and a tint does that with less ink than a rule under every row.
		if (index % 2 === 1) {
			s.rect({ x: M - 4, top: top - 2, width: CONTENT + 8, height, radius: 3, fill: COLORS.muted });
		}

		const returned = row.rto_orders + row.return_orders;
		const profitColor = row.profit >= 0 ? COLORS.success : COLORS.destructive;
		let x = M;

		for (const column of columns) {
			const right = x + column.width - 4;
			const cellTop = top + 1.5;
			switch (column.key) {
				case 'sku': {
					const name = row.product_name && row.product_name !== row.sku ? row.product_name : '';
					const label = row.cost_mapped ? row.sku : `${row.sku} *`;
					const skuW = s.text(label, { x, top: cellTop, size: 7.5, maxWidth: column.width - 8 });
					if (name && skuW + 8 < column.width - 30) {
						s.text(name, {
							x: x + skuW + 6,
							top: cellTop + 0.4,
							size: 6.5,
							color: COLORS.faint,
							maxWidth: column.width - skuW - 14,
						});
					}
					break;
				}
				case 'orders':
					s.text(formatNumber(row.orders), { x: right, top: cellTop, size: 7.5, align: 'right' });
					break;
				case 'units':
					s.text(formatNumber(row.units), { x: right, top: cellTop, size: 7.5, align: 'right' });
					break;
				case 'delivered':
					s.text(formatNumber(row.delivered_orders), { x: right, top: cellTop, size: 7.5, align: 'right' });
					break;
				case 'returned':
					s.text(formatNumber(returned), {
						x: right,
						top: cellTop,
						size: 7.5,
						align: 'right',
						color: returned > 0 ? COLORS.destructive : COLORS.foreground,
					});
					break;
				case 'settlement':
					s.money(row.net_settlement, { x: right, top: cellTop, size: 7.5, align: 'right' });
					break;
				case 'cogs':
					s.money(row.cogs, { x: right, top: cellTop, size: 7.5, align: 'right', color: COLORS.mutedForeground });
					break;
				case 'profit':
					s.money(row.profit, { x: right, top: cellTop, size: 7.5, align: 'right', bold: true, color: profitColor });
					break;
				case 'margin':
					s.text(formatPercent(row.margin_pct), {
						x: right,
						top: cellTop,
						size: 7.5,
						align: 'right',
						color: COLORS.mutedForeground,
					});
					break;
			}
			x += column.width;
		}
	}

	// -- the working ----------------------------------------------------------------------------

	/**
	 * What the seller told the tool, printed alongside what it concluded.
	 *
	 * Every figure above depends on two things Meesho's file does not contain: what each item cost
	 * to make, and how much of a returned one is actually lost. A report that showed the answers
	 * without the assumptions would be unauditable a month later.
	 */
	private drawAssumptions(top: number): void {
		const { expenses, expenseDays, result } = this.input;
		const rates = result.loss_rates;
		const rows = expenses.filter((row) => row.monthly > 0);

		const rateRows: { label: string; value: number }[] = [
			{ label: 'Courier return — item', value: rates.rto },
			{ label: 'Customer return — item', value: rates.return_rate },
			{ label: 'Lost in transit — item', value: rates.lost },
			{ label: 'Courier return — packaging', value: rates.rto_packaging_loss },
			{ label: 'Customer return — packaging', value: rates.return_packaging_loss },
		];

		// Both boxes are as tall as the taller one's contents, so a seller who has entered one
		// expense doesn't get the same half-empty card as one who has entered four.
		const expensesBottom = rows.length > 0 ? 42 + rows.length * 12 + 16 : 42 + 28;
		const boxHeight = Math.max(expensesBottom, 42 + rateRows.length * 12) + 12;
		// Header, the boxes, and three lines of footnote — the whole block moves overleaf together
		// or the footnote ends up orphaned under a page break.
		let y = this.fit(top, 30 + boxHeight + 10 + 34, 'Your assumptions');
		const s = this.sheet;

		s.text('Your assumptions', { x: M, top: y, size: 12, bold: true });
		s.text('The figures Meesho does not know, which you gave the tool.', {
			x: M,
			top: y + 16,
			size: 7.5,
			color: COLORS.mutedForeground,
			maxWidth: CONTENT,
		});
		y += 30;

		const gap = 12;
		const width = (CONTENT - gap) / 2;

		// Business expenses, and the share of them this payment window carries.
		s.rect({ x: M, top: y, width, height: boxHeight, radius: 9, fill: COLORS.card, stroke: COLORS.border, strokeWidth: 0.8 });
		s.text('Business expenses', { x: M + 12, top: y + 12, size: 9, bold: true });
		s.text(`${formatNumber(expenseDays)} of 30 days charged to this period`, {
			x: M + 12,
			top: y + 25,
			size: 7,
			color: COLORS.mutedForeground,
			maxWidth: width - 24,
		});

		let rowTop = y + 42;
		if (rows.length === 0) {
			// Wrapped, not clipped: this is a sentence, and half of it is worse than none of it.
			s.paragraph('None entered. The profit above is trading profit only — it does not yet pay your rent.', {
				x: M + 12,
				top: rowTop,
				size: 7.5,
				color: COLORS.mutedForeground,
				maxWidth: width - 24,
				lineHeight: 11,
			});
		} else {
			s.text('MONTHLY', { x: M + width - 74, top: rowTop - 11, size: 6, bold: true, color: COLORS.faint, align: 'right', tracking: 0.4 });
			s.text('THIS PERIOD', { x: M + width - 12, top: rowTop - 11, size: 6, bold: true, color: COLORS.faint, align: 'right', tracking: 0.4 });
			for (const row of rows) {
				s.text(row.label, { x: M + 12, top: rowTop, size: 7.5, maxWidth: width - 100 });
				s.money(row.monthly, { x: M + width - 74, top: rowTop, size: 7.5, align: 'right', color: COLORS.mutedForeground });
				s.money(prorate(row.monthly, expenseDays), { x: M + width - 12, top: rowTop, size: 7.5, align: 'right' });
				rowTop += 12;
			}
			s.line({ x1: M + 12, y1: rowTop + 1, x2: M + width - 12, y2: rowTop + 1, color: COLORS.border });
			s.text('Charged to this period', { x: M + 12, top: rowTop + 7, size: 7.5, bold: true });
			s.money(this.input.overheads, { x: M + width - 12, top: rowTop + 7, size: 7.5, align: 'right', bold: true });
		}

		// Write-off rates: how much of a returned item the seller actually loses.
		const rx = M + width + gap;
		s.rect({ x: rx, top: y, width, height: boxHeight, radius: 9, fill: COLORS.card, stroke: COLORS.border, strokeWidth: 0.8 });
		s.text('Return write-off rates', { x: rx + 12, top: y + 12, size: 9, bold: true });
		s.text('How much of a returned order you count as lost.', {
			x: rx + 12,
			top: y + 25,
			size: 7,
			color: COLORS.mutedForeground,
			maxWidth: width - 24,
		});

		let rateTop = y + 42;
		for (const rate of rateRows) {
			s.text(rate.label, { x: rx + 12, top: rateTop, size: 7.5, maxWidth: width - 70 });
			s.text(`${Math.round((rate.value ?? 0) * 100)}%`, {
				x: rx + width - 12,
				top: rateTop,
				size: 7.5,
				align: 'right',
				color: COLORS.mutedForeground,
			});
			rateTop += 12;
		}

		y += boxHeight + 10;
		s.paragraph(
			'* A product marked with an asterisk has no making or packing cost recorded, so its profit is overstated. ' +
				'Ads spend and business expenses are account-wide and are not split across products — a product\'s profit ' +
				'is before both. Meesho deducts its commission, forward shipping and return fees before settling, so those ' +
				'are already inside the settlement figure rather than subtracted again.',
			{ x: M, top: y, size: 7, color: COLORS.faint, maxWidth: CONTENT, lineHeight: 9.5 },
		);
	}
}

interface Column {
	key: string;
	label: string;
	width: number;
	align: 'left' | 'right';
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function longDate(date: Date): string {
	return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
