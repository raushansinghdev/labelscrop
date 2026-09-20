import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from 'cn';
import { formatCurrency, formatNumber } from '../format';
import type { StatusRow } from '../types';
import { ChartCard, ChartTooltip } from './ChartCard';

/**
 * Colour and wording per normalised status. The calculator emits Meesho's own vocabulary; "RTO"
 * means nothing to a new seller, so each one is relabelled in plain terms.
 *
 * Colours are Tailwind utility pairs rather than colour strings: the slice needs a `fill-*`
 * (SVG presentation attributes don't resolve `var()` reliably), and the legend dot beside it is
 * an HTML element, so it needs the matching `bg-*`.
 */
const STATUS_META: Record<string, Meta> = {
	delivered: { label: 'Delivered', fill: 'fill-chart-2', dot: 'bg-chart-2' },
	exchange: { label: 'Exchanged', fill: 'fill-chart-5', dot: 'bg-chart-5' },
	rto: { label: 'Returned to you', fill: 'fill-chart-3', dot: 'bg-chart-3' },
	return: { label: 'Customer returned', fill: 'fill-chart-4', dot: 'bg-chart-4' },
	cancelled: { label: 'Cancelled', fill: 'fill-muted-foreground', dot: 'bg-muted-foreground' },
	lost: { label: 'Lost in transit', fill: 'fill-chart-1', dot: 'bg-chart-1' },
	shipped: { label: 'Still shipping', fill: 'fill-chart-1', dot: 'bg-chart-1' },
};

interface Meta {
	label: string;
	fill: string;
	dot: string;
}

const UNKNOWN: Meta = { label: 'Status missing', fill: 'fill-border', dot: 'bg-border' };

interface StatusDonutProps {
	breakdown: StatusRow[];
}

interface Slice {
	name: string;
	value: number;
	percentage: number;
	settlement: number;
	fill: string;
	dot: string;
	/** Set only on the rolled-up slice, so its tooltip can say what it swallowed. */
	parts?: string[];
}

/**
 * Below this, a slice is a hairline on a 144px donut and a legend row nobody reads. A real file
 * carries four or five of them — one cancelled order, one still shipping, one blank status — and
 * they turned a seven-row legend into mostly noise around the three lines that matter.
 */
const MIN_SLICE_PCT = 2;

export function StatusDonut({ breakdown }: StatusDonutProps) {
	if (breakdown.length === 0) return null;

	const all: Slice[] = breakdown
		.map((item) => {
			const meta = STATUS_META[item.status] ?? UNKNOWN;
			return {
				name: meta.label,
				value: item.order_count,
				percentage: item.percentage,
				settlement: item.total_settlement,
				fill: meta.fill,
				dot: meta.dot,
			};
		})
		// Largest first. The calculator emits its own order, which put 80% delivered third in the
		// legend, under two statuses worth 12% between them.
		.sort((a, b) => b.value - a.value);

	const total = all.reduce((sum, d) => sum + d.value, 0);

	const tiny = all.filter((d) => d.percentage < MIN_SLICE_PCT);
	const data: Slice[] = all.filter((d) => d.percentage >= MIN_SLICE_PCT);
	// One stray status is clearer named than hidden behind "Other"; two or more are noise.
	if (tiny.length > 1) {
		data.push({
			name: 'Other',
			value: tiny.reduce((sum, d) => sum + d.value, 0),
			percentage: tiny.reduce((sum, d) => sum + d.percentage, 0),
			settlement: tiny.reduce((sum, d) => sum + d.settlement, 0),
			fill: 'fill-muted-foreground/40',
			dot: 'bg-muted-foreground/40',
			parts: tiny.map((d) => `${d.name} ${formatNumber(d.value)}`),
		});
	} else {
		data.push(...tiny);
	}

	return (
		<ChartCard
			title="How orders ended up"
			caption="Deliveries earn; returns cost you the packaging and often the item too."
			badge={`${formatNumber(total)} orders`}
		>
			{/* Stacked, not side by side: this card now lives in a 20rem column, which is not wide
			  * enough to put a 144px donut and seven legend rows next to each other. */}
			<div className="flex flex-col items-center gap-3">
				<div className="relative h-36 w-36 shrink-0">
					<ResponsiveContainer>
						<PieChart>
							<Pie
								data={data}
								cx="50%"
								cy="50%"
								innerRadius={43}
								outerRadius={66}
								paddingAngle={2}
								dataKey="value"
								stroke="none"
							>
								{data.map((entry) => (
									<Cell key={entry.name} className={entry.fill} />
								))}
							</Pie>
							<Tooltip content={<StatusTooltip />} />
						</PieChart>
					</ResponsiveContainer>
					{/* Centred as HTML rather than an SVG <text>, so it inherits the page font and
					  * theme colours instead of needing them restated in SVG attributes. */}
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
						<span className="text-xl font-semibold tabular-nums tracking-tight">{formatNumber(total)}</span>
						<span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Orders</span>
					</div>
				</div>

				<ul className="w-full space-y-1">
					{data.map((d) => (
						<li key={d.name} className="flex items-center justify-between gap-3 text-xs">
							<span className="flex min-w-0 items-center gap-2">
								<span className={cn('h-2 w-2 shrink-0 rounded-full', d.dot)} aria-hidden="true" />
								<span className="truncate">{d.name}</span>
							</span>
							<span className="shrink-0 tabular-nums text-muted-foreground">
								{formatNumber(d.value)} · {d.percentage.toFixed(0)}%
							</span>
						</li>
					))}
				</ul>
			</div>
		</ChartCard>
	);
}

function StatusTooltip({ active, payload }: { active?: boolean; payload?: { payload: Slice }[] }) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload;
	return (
		<ChartTooltip label={d.name}>
			<p>
				{formatNumber(d.value)} orders ({d.percentage.toFixed(1)}%)
			</p>
			<p>{formatCurrency(d.settlement)} settled</p>
			{d.parts && <p className="text-[11px]">{d.parts.join(' · ')}</p>}
		</ChartTooltip>
	);
}
