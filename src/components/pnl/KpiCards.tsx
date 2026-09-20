import {
	BanknoteIcon,
	BuildingIcon,
	MegaphoneIcon,
	PackageIcon,
	ShoppingBagIcon,
	TrendingDownIcon,
	TrendingUpIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { AnimatedNumber, ProgressMeter, SPRING, STAGGER_ITEM, STAGGER_LIST } from './motion';
import type { PnlOverall } from './types';

interface KpiCardsProps {
	overall: PnlOverall;
	/** Fixed business expenses for this period, already prorated. Zero until the seller sets them. */
	overheads: number;
}

interface Tile {
	label: string;
	value: number;
	format: (value: number) => string;
	hint: string;
	icon: LucideIcon;
}

export function KpiCards({ overall, overheads }: KpiCardsProps) {
	// The headline is profit *after* rent and salary, because that is the number that reaches the
	// seller's pocket. Trading profit before overheads is still shown, one line below, so the two
	// never get confused — and so a seller who has entered no expenses sees them agree.
	const realProfit = overall.net_profit - overheads;
	// Margin is against settlement received, not gross sale value — settlement is the only
	// number Meesho actually pays out, so it's the honest denominator.
	const marginPct = overall.net_settlement !== 0 ? (realProfit / overall.net_settlement) * 100 : null;
	const positive = realProfit >= 0;
	// Divided by orders rather than units, and by units rather than orders, deliberately: an order
	// is what gets packed and shipped, a unit is what gets made. Both are real questions a seller
	// asks and they differ whenever anyone buys two of something.
	const perOrder = overall.total_orders > 0 ? realProfit / overall.total_orders : 0;
	const perUnit = overall.total_units > 0 ? realProfit / overall.total_units : 0;

	const tiles: Tile[] = [
		{
			label: 'Settlement',
			value: overall.net_settlement,
			format: formatCurrency,
			hint: 'What Meesho actually paid out',
			icon: BanknoteIcon,
		},
		{
			label: 'Cost of goods',
			value: overall.cogs,
			format: formatCurrency,
			hint: `Making ${formatCurrency(overall.cogs_making)} · Packing ${formatCurrency(overall.cogs_packaging)}`,
			icon: PackageIcon,
		},
		{
			label: 'Ads spend',
			value: overall.ads_cost,
			format: formatCurrency,
			hint: 'Account-level, not per SKU',
			icon: MegaphoneIcon,
		},
		{
			label: 'Business expenses',
			value: -overheads,
			format: formatCurrency,
			hint: overheads > 0 ? 'Rent, salary and bills for this period' : 'Not set yet — add them in Expenses',
			icon: BuildingIcon,
		},
		{
			label: 'Orders',
			value: overall.total_orders,
			format: formatNumber,
			hint: `${formatNumber(overall.total_units)} units shipped`,
			icon: ShoppingBagIcon,
		},
	];

	return (
		<motion.div variants={STAGGER_LIST} initial="hidden" animate="show" className="space-y-2">
			{/* The headline. Everything else on this screen exists to explain this one number, so it
			  * gets the size and the colour and the rest stay monochrome. */}
			<motion.section
				variants={STAGGER_ITEM}
				className={cn(
					'relative overflow-hidden rounded-2xl border p-4',
					positive ? 'border-success/25 bg-success/[0.06]' : 'border-destructive/25 bg-destructive/[0.06]',
				)}
			>
				{/* A soft wash behind the figure rather than a solid fill — keeps the number readable
				  * in both themes while still reading green or red at a glance. */}
				<div
					aria-hidden="true"
					className={cn(
						'pointer-events-none absolute -right-12 -top-16 size-40 rounded-full blur-3xl',
						positive ? 'bg-success/20' : 'bg-destructive/20',
					)}
				/>

				<div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
				<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="text-xs font-medium text-muted-foreground">Net profit</p>
					<motion.span
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ ...SPRING, delay: 0.15 }}
						className={cn(
							'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
							positive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
						)}
					>
						{positive ? (
							<TrendingUpIcon className="size-3" aria-hidden="true" />
						) : (
							<TrendingDownIcon className="size-3" aria-hidden="true" />
						)}
						{formatPercent(marginPct)} margin
					</motion.span>
				</div>

				<p
					className={cn(
						'mt-0.5 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl',
						positive ? 'text-success' : 'text-destructive',
					)}
				>
					<AnimatedNumber value={realProfit} format={formatCurrency} />
				</p>

				<p className="mt-1 text-xs text-muted-foreground">
					kept from {formatCurrency(overall.net_settlement)} of settlement across{' '}
					{formatNumber(overall.total_orders)} orders
					{overheads > 0 && (
						<>
							{', after '}
							<span className="tabular-nums">{formatCurrency(overheads)}</span> of business expenses
						</>
					)}
				</p>

				{/* How much of the payout survived to profit, as a bar. The percentage above says the
				  * same thing, but a bar is read without arithmetic. */}
				<div className="mt-3">
					<ProgressMeter
						value={overall.net_settlement > 0 ? realProfit / overall.net_settlement : 0}
						className={cn('h-full rounded-full', positive ? 'bg-success' : 'bg-destructive')}
						trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{positive
							? 'Share of your payout that stayed with you.'
							: 'You paid out more than you were settled for this period.'}
					</p>
				</div>
				</div>

				{/* The right third of this card used to be empty — a ₹8,556 headline floating in a
				  * quarter of the screen. Per-order economics are what a seller actually reasons with:
				  * a total tells you how the month went, but ₹12 an order tells you whether the next
				  * one is worth packing. Two cells on a phone, stacked on a laptop. */}
				<dl
					className={cn(
						'grid shrink-0 grid-cols-2 overflow-hidden rounded-xl border sm:w-40 sm:grid-cols-1',
						positive ? 'border-success/20 bg-background/60' : 'border-destructive/20 bg-background/60',
					)}
				>
					<PerUnit label="Per order" value={perOrder} positive={positive} />
					<PerUnit
						label="Per unit"
						value={perUnit}
						positive={positive}
						className="border-l sm:border-l-0 sm:border-t"
					/>
				</dl>
				</div>
			</motion.section>

			<div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
				{tiles.map((tile, index) => (
					<motion.div
						key={tile.label}
						variants={STAGGER_ITEM}
						className={cn(
							'group rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20',
							// Five tiles in two columns leaves the last one as a half-width orphan on a
							// phone. It takes the whole row instead.
							index === tiles.length - 1 && 'col-span-2 lg:col-span-1',
						)}
					>
						<div className="flex items-center gap-1.5 text-muted-foreground">
							<tile.icon className="size-3 shrink-0" aria-hidden="true" />
							<p className="truncate text-[11px] font-medium">{tile.label}</p>
						</div>
						<p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
							<AnimatedNumber value={tile.value} format={tile.format} />
						</p>
						<p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{tile.hint}</p>
					</motion.div>
				))}
			</div>
		</motion.div>
	);
}

/** One cell of the per-order panel. */
function PerUnit({
	label,
	value,
	positive,
	className,
}: {
	label: string;
	value: number;
	positive: boolean;
	className?: string;
}) {
	return (
		<div className={cn('px-3 py-2', positive ? 'border-success/20' : 'border-destructive/20', className)}>
			<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					'mt-0.5 text-base font-semibold tabular-nums tracking-tight',
					positive ? 'text-success' : 'text-destructive',
				)}
			>
				<AnimatedNumber value={value} format={formatCurrency} />
			</dd>
		</div>
	);
}
