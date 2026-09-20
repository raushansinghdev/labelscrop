import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
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
import { AXIS_TICK, BAR_RADIUS, GRID_CLASS, MAX_BAR, compactInr, useChartMotion } from './theme';
import { buildWaterfall, niceAxis, type WaterfallBar } from './waterfall';

interface PnlWaterfallProps {
	overall: PnlOverall;
	overheads: number;
}

/** Row pitch. 24px of bar plus 14px of air, which is what stops ten steps reading as a block. */
const ROW = 38;

/**
 * The two gutters: names on the left, figures on the right, with the plot between them.
 *
 * They shrink on a phone because they are spent from the same 326px the bars need. 92px still
 * holds "Packaging lost" at 12px, which is the longest name the calculator emits; below that the
 * names would collide with the plot, which is worse than a short bar.
 */
const GUTTERS = { narrow: { label: 92, value: 46 }, wide: { label: 108, value: 64 } };

export function PnlWaterfall({ overall, overheads }: PnlWaterfallProps) {
	const data = buildWaterfall(overall, overheads);
	const motion = useChartMotion();
	const narrow = useMediaQuery('(max-width: 639px)');
	const gutter = narrow ? GUTTERS.narrow : GUTTERS.wide;

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
	const axis = niceAxis(Math.min(0, ...bounds), Math.max(0, ...bounds), narrow ? 3 : 5);

	return (
		<ChartCard
			title="Where the money went"
			caption="Start at what Meesho paid you, subtract every cost, and land on what you actually kept."
			badge={formatCurrency(overall.net_profit - overheads)}
		>
			{/*
			 * Horizontal at every width, not just on a phone.
			 *
			 * As columns this had eight names to fit along the bottom, so they were rotated to 40
			 * degrees — a chart you tilt your head to read, and the thing that made this card look
			 * broken. Turning it on its side gives every step a full-width label set flat beside its
			 * own bar, room for the figure at the bar's tip, and a bridge that reads top to bottom,
			 * which is the direction the page scrolls anyway. It also stops caring how many steps
			 * there are: a tenth one adds a row instead of squeezing the other nine.
			 */}
			<div style={{ height: shown.length * ROW + 34 }} className="w-full">
				<ResponsiveContainer>
					<BarChart data={shown} layout="vertical" margin={{ top: 4, right: gutter.value, bottom: 4, left: 0 }}>
						<CartesianGrid className={GRID_CLASS} horizontal={false} strokeOpacity={0.7} />
						<XAxis
							type="number"
							domain={axis.domain}
							ticks={axis.ticks}
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
							tickFormatter={compactInr}
						/>
						<YAxis
							type="category"
							dataKey="name"
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
							width={gutter.label}
							interval={0}
						/>
						<Tooltip content={<WaterfallTooltip />} cursor={{ className: 'fill-muted/40' }} />
						<ReferenceLine x={0} className="stroke-border" />
						{/* One bar per step, drawn between the running totals either side of it —
						  * recharts reads a `[from, to]` tuple as a floating bar. */}
						<Bar dataKey="range" radius={BAR_RADIUS} maxBarSize={MAX_BAR} {...motion}>
							{shown.map((entry) => (
								<Cell key={entry.name} className={entry.className} />
							))}
							{/* A value on every bar, which is normally the wrong instinct — but each step
							  * here owns a whole row, so nothing can collide, and a bridge whose step
							  * sizes are only readable by hovering is no use on a phone at all. */}
							<LabelList dataKey="delta" content={<DeltaLabel gutter={gutter.label} />} />
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</ChartCard>
	);
}

interface LabelProps {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	value?: number;
	/** The name gutter's width, i.e. where the plot starts. */
	gutter?: number;
}

/** Roughly the widest this text gets ("−₹71k") — enough to test whether it has room. */
const TEXT_WIDTH = 44;

/**
 * The step's own figure, pinned just past the end of its bar.
 *
 * The geometry needs normalising first. On a floating `[from, to]` bar recharts reports a
 * *negative* width for a step that subtracts, so `x` is the right-hand edge and `x + width` the
 * left — read naively, every cost label landed inside its own bar instead of beside it.
 *
 * The tip is then whichever end the running total arrived at: the left edge for a step that
 * subtracts, the right for one that adds. A cost whose tip lands near zero has no room on its
 * left, so that one flips to the far end of its bar rather than printing over the step names —
 * the gutter width is passed in precisely so this can be decided without measuring. (Not
 * `viewBox`: recharts passes the *bar's* rect under that name, not the plot's, so testing
 * against it says only that a label doesn't fit inside its own bar, which is always true.)
 *
 * Signed with a real minus rather than a hyphen — at 12px a hyphen beside ₹ disappears.
 */
function DeltaLabel({ x = 0, y = 0, width = 0, height = 0, value = 0, gutter = 0 }: LabelProps) {
	const negative = value < 0;
	const left = Math.min(x, x + width);
	const right = Math.max(x, x + width);

	const clearsGutter = left - 6 - TEXT_WIDTH > gutter + 4;
	const outside = negative && clearsGutter ? left - 6 : right + 6;
	const anchor = negative && clearsGutter ? 'end' : 'start';

	return (
		<text
			x={outside}
			y={y + height / 2}
			textAnchor={anchor}
			dominantBaseline="central"
			className="fill-foreground text-[12px] font-medium tabular-nums"
		>
			{negative ? '−' : '+'}
			{compactInr(Math.abs(value)).replace('-', '')}
		</text>
	);
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
