import { formatCurrency, formatCurrencyExact } from '../format';
import type { PnlOverall } from '../types';
import { useMediaQuery } from '../useMediaQuery';
import { BarRows, type BarRow } from './BarRows';
import { ChartCard } from './ChartCard';
import { signedInr } from './theme';
import { buildWaterfall, niceAxis, type WaterfallBar } from './waterfall';

interface PnlWaterfallProps {
	overall: PnlOverall;
	overheads: number;
}

/**
 * The two gutters: names on the left, figures on the right, with the plot between them.
 *
 * They shrink on a phone because they are spent from the same 326px the bars need. 92px still
 * holds "Packaging lost" at 12px, which is the longest name the calculator emits.
 */
const GUTTERS = { narrow: { label: 92, value: 46 }, wide: { label: 108, value: 64 } };

export function PnlWaterfall({ overall, overheads }: PnlWaterfallProps) {
	const data = buildWaterfall(overall, overheads);
	const narrow = useMediaQuery('(max-width: 639px)');
	const gutter = narrow ? GUTTERS.narrow : GUTTERS.wide;

	// Bars that would round to zero rupees carry no information and just crowd the names.
	const shown: WaterfallBar[] = data.filter((d) => Math.abs(d.delta) >= 1 || d.name === 'Net profit');

	// Both ends of every bar, so a seller whose expenses take them below zero still has every bar
	// inside the plot.
	const bounds = shown.flatMap((d) => d.range);
	const axis = niceAxis(Math.min(0, ...bounds), Math.max(0, ...bounds), narrow ? 3 : 5);

	const rows: BarRow[] = shown.map((d, index) => {
		const total = index === shown.length - 1 && d.name === 'Net profit';
		return {
			key: d.name,
			label: d.name,
			from: d.range[0],
			to: d.range[1],
			value: d.delta,
			barClass: d.barClass,
			emphasis: total,
			// Each step hands its running total down to the next one; the closing bar is drawn
			// from zero and lands on that same total, so the last hairline meets its tip.
			connect: !total,
			detail: (
				<>
					<p className={d.delta >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
						{d.delta >= 0 ? '+' : '−'}
						{formatCurrencyExact(Math.abs(d.delta))}
					</p>
					{d.detail && <p className="whitespace-pre-line text-xs">{d.detail}</p>}
					{total && <p className="text-xs">What you kept after every cost on this file.</p>}
				</>
			),
		};
	});

	return (
		<ChartCard
			title="Where the money went"
			caption="Start at what Meesho paid you, subtract every cost, and land on what you actually kept."
			badge={formatCurrency(overall.net_profit - overheads)}
		>
			{/* Horizontal, so every step gets a flat, full-width name beside its own bar and the
			  * bridge reads top to bottom — the direction the page scrolls anyway. */}
			<BarRows
				rows={rows}
				domain={axis.domain}
				ticks={axis.ticks}
				labelWidth={gutter.label}
				valueWidth={gutter.value}
				format={signedInr}
				hint="Tap any bar to see what's in it."
			/>
		</ChartCard>
	);
}
