import { ArrowRightIcon, RotateCcwIcon, TrendingDownIcon, TrophyIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { formatCurrency, formatNumber } from './format';
import { STAGGER_ITEM, STAGGER_LIST } from './motion';
import type { PnlResult } from './types';

interface ProfitInsightsProps {
	result: PnlResult;
	/** Where "which SKU?" is answered. */
	onOpenProducts: () => void;
	/** Where the return write-off rates live. */
	onOpenExpenses: () => void;
}

/**
 * The three questions a seller opens this tool with, answered before any chart.
 *
 * The KPI tiles above say what happened; these say what to *do* about it. A total settlement figure
 * is not actionable — "this SKU lost you ₹2,400" is. Each card is a button that lands on the screen
 * where the thing it names can be changed, so noticing a problem and fixing it are one gesture.
 */
export function ProfitInsights({ result, onOpenProducts, onOpenExpenses }: ProfitInsightsProps) {
	const { overall, sku_rows } = result;
	if (sku_rows.length === 0) return null;

	const sorted = [...sku_rows].sort((a, b) => b.profit - a.profit);
	const best = sorted[0];
	const worst = sorted[sorted.length - 1];
	// Only a genuine loss-maker is worth naming. A "worst" SKU that still earns money is just the
	// bottom of a healthy list, and calling it out would send sellers hunting for a problem that
	// isn't there.
	const drain = worst && worst.profit < 0 ? worst : null;
	const losers = sku_rows.filter((r) => r.profit < 0).length;

	const returnedOrders = sku_rows.reduce((sum, r) => sum + r.rto_orders + r.return_orders, 0);
	const returnRate = overall.total_orders > 0 ? (returnedOrders / overall.total_orders) * 100 : 0;
	// What came back actually cost: the item written off plus the packaging consumed. Reverse
	// shipping isn't added here — Meesho already deducted it before settling, so it is inside the
	// settlement figure and counting it again would double it.
	const returnCost = overall.cogs_making_lost + overall.cogs_packaging_lost;

	return (
		<motion.div
			variants={STAGGER_LIST}
			initial="hidden"
			animate="show"
			className="grid gap-2 sm:grid-cols-3"
		>
			<InsightCard
				icon={TrophyIcon}
				tone="good"
				label="Best earner"
				value={formatCurrency(best.profit)}
				detail={best.sku}
				hint={`${formatNumber(best.orders)} orders · this SKU is carrying you`}
				onClick={onOpenProducts}
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
					onClick={onOpenProducts}
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
					onClick={onOpenProducts}
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
				onClick={onOpenExpenses}
			/>
		</motion.div>
	);
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
	onClick,
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
	onClick: () => void;
}) {
	const toneClasses = TONES[tone];

	return (
		<motion.button
			variants={STAGGER_ITEM}
			type="button"
			onClick={onClick}
			whileTap={{ scale: 0.99 }}
			className={cn(
				'group flex w-full min-w-0 items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-left',
				'transition-colors hover:border-foreground/20 hover:bg-muted/40',
				'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
			)}
		>
			<span
				className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', toneClasses.icon)}
				aria-hidden="true"
			>
				<Icon className="size-4" />
			</span>

			<span className="min-w-0 flex-1">
				<span className="flex items-center justify-between gap-2">
					<span className="text-[11px] font-medium text-muted-foreground">{label}</span>
					<ArrowRightIcon
						className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
						aria-hidden="true"
					/>
				</span>
				<span className="mt-0.5 flex items-baseline gap-1.5">
					<span className={cn('text-base font-bold tabular-nums tracking-tight', toneClasses.value)}>
						{value}
					</span>
					{/* The SKU code sits beside the figure rather than under it: on a phone these cards
					  * stack, and a third line each turns three cards into most of a screen. */}
					<span
						className={cn(
							'min-w-0 truncate text-[11px] text-muted-foreground',
							!plainDetail && 'font-mono',
						)}
					>
						{detail}
					</span>
				</span>
				<span className="mt-0.5 block truncate text-[11px] leading-snug text-muted-foreground">{hint}</span>
			</span>
		</motion.button>
	);
}
