import { RotateCcwIcon, TrendingDownIcon, TrophyIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { deriveInsights } from './derive';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { MetricTooltip, MetricTooltipProvider, type MetricRow } from './MetricTooltip';
import { RESULT_ITEM, RESULT_STAGGER, TAP_CARD } from './motion';
import type { PnlResult, SkuRow } from './types';

interface ProfitInsightsProps {
	result: PnlResult;
}

/**
 * The three questions a seller opens this tool with, answered before any chart.
 *
 * The KPI tiles above say what happened; these name the SKU it happened to. Each one used to be a
 * button that jumped to another tab, which meant a curious hover cost you your place on the page —
 * and the figure itself was never explained, only labelled. So they explain themselves on hover
 * instead, and the trip to the full SKU table is offered once, from the chart that lists SKUs.
 */
export function ProfitInsights({ result }: ProfitInsightsProps) {
	const { overall } = result;
	// Only a genuine loss-maker is worth naming. A "worst" SKU that still earns money is just the
	// bottom of a healthy list, and calling it out would send sellers hunting for a problem that
	// isn't there — so `drain` is null unless it really loses money. The arithmetic lives in
	// `derive.ts` so the downloaded report names the same SKUs.
	const insights = deriveInsights(result);
	if (!insights) return null;
	const { best, worst, drain, losers, redTotal, rtoOrders, customerReturns, returnedOrders, returnRate, returnCost, returnFee } =
		insights;

	return (
		<MetricTooltipProvider>
			<motion.div
				variants={RESULT_STAGGER}
				initial="hidden"
				animate="show"
				className="grid gap-2.5 sm:grid-cols-3"
			>
				<InsightCard
					icon={TrophyIcon}
					tone="good"
					label="Best earner"
					value={formatCurrency(best.profit)}
					detail={best.sku}
					hint={`${formatNumber(best.orders)} orders · this SKU is carrying you`}
					tooltipTitle={`Best earner · ${best.sku}`}
					meaning="The SKU that put the most money in your pocket this period, counting only what it earned and what it cost to make and pack."
					rows={skuRows(best)}
					footnote={
						best.cost_mapped
							? 'Ads spend and business expenses are account-wide, so they sit outside this figure.'
							: 'No making or packing cost is recorded for this SKU, so this profit is overstated.'
					}
				/>

				{drain ? (
					<InsightCard
						icon={TrendingDownIcon}
						tone="bad"
						label="Losing you money"
						value={formatCurrency(drain.profit)}
						detail={drain.sku}
						hint={
							losers > 1
								? `${formatNumber(losers)} SKUs are in the red`
								: `${formatNumber(drain.orders)} orders, all at a loss`
						}
						tooltipTitle={`Losing you money · ${drain.sku}`}
						meaning="The SKU that cost you more than it brought in. Every order of it this period made your month slightly worse."
						rows={[
							...skuRows(drain),
							{
								term: `All ${formatNumber(losers)} loss-making SKUs`,
								value: formatCurrency(redTotal),
								tone: 'bad' as const,
								when: losers > 1,
							},
						]}
						footnote={
							drain.cost_mapped
								? 'Returns are the usual cause: the item comes back unsellable while the packing and reverse shipping stay spent.'
								: 'No making or packing cost is recorded for this SKU, so the real loss may be larger.'
						}
					/>
				) : (
					<InsightCard
						icon={TrendingDownIcon}
						tone="good"
						label="Losing you money"
						value="None"
						detail="Every SKU earns"
						plainDetail
						hint={`Thinnest is ${worst.sku} at ${formatCurrency(worst.profit)}`}
						tooltipTitle="Losing you money · none"
						meaning="No SKU you sold this period cost more than it brought in. The thinnest one still earns, it just earns least."
						rows={[
							{ term: 'Thinnest SKU', value: worst.sku },
							{ term: 'Its profit', value: formatCurrency(worst.profit), tone: 'good' },
							{ term: 'Its margin', value: formatPercent(worst.margin_pct) },
							{ term: 'Its orders', value: formatNumber(worst.orders) },
						]}
						footnote="Worth watching all the same: a SKU this thin turns loss-making the moment its return rate rises."
					/>
				)}

				<InsightCard
					icon={RotateCcwIcon}
					tone={returnRate >= 20 ? 'bad' : 'warn'}
					label="Returns cost you"
					value={formatCurrency(returnCost)}
					detail={`${returnRate.toFixed(0)}% came back`}
					plainDetail
					hint={`${formatNumber(returnedOrders)} of ${formatNumber(overall.total_orders)} orders · stock and packaging written off`}
					tooltipTitle="Returns cost you"
					meaning="What the orders that came back took off your shelf: the item you can no longer sell, plus the packaging it went out in."
					rows={[
						{
							term: 'Courier return (RTO)',
							value: `${formatNumber(rtoOrders)} orders`,
						},
						{
							term: 'Customer returned',
							value: `${formatNumber(customerReturns)} orders`,
						},
						{ term: 'Return rate', value: `${returnRate.toFixed(1)}%`, tone: returnRate >= 20 ? 'bad' : undefined },
						{ term: 'Item cost written off', value: formatCurrency(overall.cogs_making_lost), tone: 'bad' },
						{
							term: 'Packaging written off',
							value: formatCurrency(overall.cogs_packaging_lost),
							tone: 'bad',
						},
						{
							term: 'Meesho return fee',
							value: formatCurrency(returnFee),
							tone: 'bad',
							when: returnFee > 0,
						},
					]}
					footnote={
						returnFee > 0
							? `The ${formatCurrency(returnFee)} return fee is not inside the headline figure: Meesho took it out before settling you, so it is already reflected in your settlement.`
							: 'How much of a returned item you actually lose is your call — set the write-off rates in Expenses.'
					}
				/>
			</motion.div>
		</MetricTooltipProvider>
	);
}

/** The same six lines for whichever SKU is being explained — best or worst, the working is identical. */
function skuRows(row: SkuRow): MetricRow[] {
	return [
		{ term: 'Orders', value: `${formatNumber(row.orders)} · ${formatNumber(row.units)} units` },
		{ term: 'Delivered', value: formatNumber(row.delivered_orders) },
		{
			term: 'Came back',
			value: formatNumber(row.rto_orders + row.return_orders),
			tone: row.rto_orders + row.return_orders > 0 ? 'bad' : undefined,
		},
		{ term: 'Settlement received', value: formatCurrency(row.net_settlement) },
		{ term: 'Making and packing', value: formatCurrency(row.cogs), tone: 'bad' },
		{ term: 'Profit', value: formatCurrency(row.profit), tone: row.profit >= 0 ? 'good' : 'bad' },
		{ term: 'Margin', value: formatPercent(row.margin_pct) },
	];
}

const TONES = {
	good: { icon: 'bg-success/12 text-success', value: 'text-success' },
	bad: { icon: 'bg-destructive/12 text-destructive', value: 'text-destructive' },
	warn: { icon: 'bg-chart-4/15 text-chart-4', value: 'text-foreground' },
} as const;

function InsightCard({
	icon: Icon,
	tone,
	label,
	value,
	detail,
	plainDetail,
	hint,
	tooltipTitle,
	meaning,
	rows,
	footnote,
}: {
	icon: LucideIcon;
	tone: keyof typeof TONES;
	label: string;
	value: string;
	/** The SKU code or short answer, directly under the figure. */
	detail: string;
	/** Set when the detail is prose rather than a SKU code, which should not be monospaced. */
	plainDetail?: boolean;
	/** One line of context, the part that makes the figure mean something. */
	hint: string;
	tooltipTitle: string;
	meaning: string;
	rows: MetricRow[];
	footnote?: string;
}) {
	const toneClasses = TONES[tone];

	return (
		<motion.div variants={RESULT_ITEM} whileTap={TAP_CARD} className="min-w-0">
			<MetricTooltip
				title={tooltipTitle}
				meaning={meaning}
				rows={rows}
				footnote={footnote}
				className={cn(
					// The cropper's choice card: a bordered card with a tinted icon tile.
					'flex h-full w-full min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-3.5',
					'transition-[border-color,background-color] duration-200 hover:border-foreground/20',
				)}
			>
				<span
					className={cn(
						'flex size-10 shrink-0 items-center justify-center rounded-xl',
						toneClasses.icon,
					)}
					aria-hidden="true"
				>
					<Icon className="size-5" />
				</span>

				<span className="min-w-0 flex-1">
					<span className="block text-xs font-medium text-muted-foreground">{label}</span>
					<span className="mt-1 flex items-baseline gap-2">
						<span className={cn('text-xl font-bold tracking-tight', toneClasses.value)}>{value}</span>
						{/* The SKU code sits beside the figure rather than under it: on a phone these cards
						  * stack, and a third line each turns three cards into most of a screen. */}
						<span
							className={cn(
								'min-w-0 truncate text-sm text-muted-foreground',
								!plainDetail && 'font-mono',
							)}
						>
							{detail}
						</span>
					</span>
					<span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{hint}</span>
				</span>
			</MetricTooltip>
		</motion.div>
	);
}
