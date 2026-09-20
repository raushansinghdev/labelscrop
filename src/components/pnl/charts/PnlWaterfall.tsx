import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { formatCurrency, formatCurrencyExact } from '../format';
import type { PnlOverall } from '../types';
import { useMediaQuery } from '../useMediaQuery';
import { ChartCard, ChartTooltip } from './ChartCard';
import { buildWaterfall, niceAxis, type WaterfallBar } from './waterfall';

interface PnlWaterfallProps {
	overall: PnlOverall;
	overheads: number;
}

export function PnlWaterfall({ overall, overheads }: PnlWaterfallProps) {
	const data = buildWaterfall(overall, overheads);
	const narrow = useMediaQuery('(max-width: 639px)');

	// Bars that would round to zero rupees carry no information and just crowd the axis labels.
	const shown: WaterfallBar[] = data.filter((d) => Math.abs(d.delta) >= 1 || d.name === 'Net profit');

	/*
	 * The value axis, stated rather than inferred.
	 *
	 * Each bar's value is a `[from, to]` tuple, and recharts does not derive a domain from tuples the
	 * way it does from plain numbers — it anchored the axis at zero. A seller whose expenses take
	 * them below zero then had the negative bars drawn outside the plot area, straight through the
	 * axis labels beside them. Taking the extremes of both ends of every bar is exact, so nothing
	 * can fall outside it.
	 */
	const bounds = shown.flatMap((d) => d.range);
	// Four intervals on a phone, five on a laptop: six labels along a 300px axis collide.
	const axis = niceAxis(Math.min(0, ...bounds), Math.max(0, ...bounds), narrow ? 4 : 5);

	return (
		<ChartCard
			title="Where the money went"
			caption="Start at what Meesho paid you, subtract every cost, and land on what you actually kept."
			badge={formatCurrency(overall.net_profit - overheads)}
		>
			{narrow ? (
				/* On its side on a phone.
				 *
				 * Eight bars across 340px left no room for "Packaging lost" under its column, so the
				 * labels were rotated to 40 degrees — a chart you tilt your head to read. Turned
				 * horizontal, every name sits flat beside its own bar and the bridge reads downwards,
				 * which is the direction a phone scrolls anyway. */
				<div style={{ height: shown.length * 30 + 28 }} className="w-full">
					<ResponsiveContainer>
						<BarChart data={shown} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
							<CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
							<XAxis
								type="number"
								domain={axis.domain}
								ticks={axis.ticks}
								tick={{ className: 'fill-muted-foreground', fontSize: 10 }}
								axisLine={false}
								tickLine={false}
								tickFormatter={compactInr}
							/>
							<YAxis
								type="category"
								dataKey="name"
								tick={{ className: 'fill-muted-foreground', fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								width={86}
								interval={0}
							/>
							<Tooltip content={<WaterfallTooltip />} cursor={{ className: 'fill-muted/40' }} />
							<ReferenceLine x={0} className="stroke-border" />
							<Bar dataKey="range" radius={3}>
								{shown.map((entry) => (
									<Cell key={entry.name} className={entry.className} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			) : (
				/* Two thirds of its old height. A waterfall is read by comparing bar *lengths*, and the
				 * ratios survive the shrink intact — the 384px version just pushed the chart below it
				 * off the screen. */
				<div className="h-56 w-full sm:h-64">
					<ResponsiveContainer>
						<BarChart data={shown} margin={{ top: 4, right: 4, bottom: 46, left: 4 }}>
							<CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
							<XAxis
								dataKey="name"
								tick={{ className: 'fill-muted-foreground', fontSize: 10 }}
								axisLine={{ className: 'stroke-border' }}
								tickLine={false}
								interval={0}
								angle={-40}
								textAnchor="end"
							/>
							<YAxis
								domain={axis.domain}
								ticks={axis.ticks}
								tick={{ className: 'fill-muted-foreground', fontSize: 10 }}
								axisLine={false}
								tickLine={false}
								width={44}
								tickFormatter={compactInr}
							/>
							<Tooltip content={<WaterfallTooltip />} cursor={{ className: 'fill-muted/40' }} />
							<ReferenceLine y={0} className="stroke-border" />
							{/* One bar per step, drawn between the running totals either side of it —
							  * recharts reads a `[from, to]` tuple as a floating bar. */}
							<Bar dataKey="range" radius={3}>
								{shown.map((entry) => (
									<Cell key={entry.name} className={entry.className} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}
		</ChartCard>
	);
}

/** "₹1.2L" / "₹45k" — full rupee counts are too wide for a mobile Y axis. */
function compactInr(value: number): string {
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
	if (abs >= 1000) return `${sign}₹${Math.round(abs / 1000)}k`;
	return `${sign}₹${Math.round(abs)}`;
}

interface TooltipPayload {
	payload: WaterfallBar;
}

function WaterfallTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
	if (!active || !payload?.length) return null;
	// Both the spacer and the visible bar are in the payload; they share one datum, so either works.
	const item = payload[0].payload;
	return (
		<ChartTooltip label={item.name}>
			<p className={item.delta >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
				{item.delta >= 0 ? '+' : '−'}
				{formatCurrencyExact(Math.abs(item.delta))}
			</p>
			{item.detail && <p className="whitespace-pre-line">{item.detail}</p>}
		</ChartTooltip>
	);
}
