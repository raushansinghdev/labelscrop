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
import { deriveOverview } from './derive';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { MetricTooltip, MetricTooltipProvider, type MetricRow } from './MetricTooltip';
import { AnimatedNumber, ProgressMeter, RESULT_ITEM, RESULT_STAGGER, SPRING } from './motion';
import { StatTile } from './StatTile';
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
	/** What the figure counts, shown on hover. */
	meaning: string;
	/** The working behind it. */
	rows: MetricRow[];
	footnote?: string;
}

export function KpiCards({ overall, overheads }: KpiCardsProps) {
	// The headline is profit *after* rent and salary, because that is the number that reaches the
	// seller's pocket. Trading profit before overheads is still shown, one line below, so the two
	// never get confused — and so a seller who has entered no expenses sees them agree. The
	// arithmetic lives in `derive.ts` so the downloaded report quotes the same figures.
	const { realProfit, marginPct, positive, perOrder, returnFee, settlementPerOrder, cogsWrittenOff, profitShare } =
		deriveOverview(overall, overheads);

	const tiles: Tile[] = [
		{
			label: 'Settlement',
			value: overall.net_settlement,
			format: formatCurrency,
			hint: 'What Meesho actually paid out',
			icon: BanknoteIcon,
			meaning: 'The money Meesho transferred to you for this period, after its commission, forward shipping and return charges were taken off.',
			rows: [
				{ term: 'Orders settled', value: formatNumber(overall.total_orders) },
				{ term: 'Average per order', value: formatCurrency(settlementPerOrder) },
				{
					term: 'Return fee already deducted',
					value: formatCurrency(returnFee),
					tone: 'bad',
					when: returnFee > 0,
				},
				{
					term: 'Referral income',
					value: formatCurrency(overall.referral_income),
					tone: 'good',
					when: overall.referral_income !== 0,
				},
				{
					term: 'Claims recovered',
					value: formatCurrency(overall.compensation_recovery),
					tone: 'good',
					when: overall.compensation_recovery !== 0,
				},
			],
			footnote: 'This is the honest starting point for everything below. The price on the listing is never what arrives in the bank.',
		},
		{
			label: 'Cost of goods',
			value: overall.cogs,
			format: formatCurrency,
			hint: `Making ${formatCurrency(overall.cogs_making)} · Packing ${formatCurrency(overall.cogs_packaging)}`,
			icon: PackageIcon,
			meaning: 'What the stock you shipped cost you — yarn, labour and time to make it, plus the packing material it went out in.',
			rows: [
				{ term: 'Making cost', value: formatCurrency(overall.cogs_making) },
				{ term: 'Packing cost', value: formatCurrency(overall.cogs_packaging) },
				{ term: 'Written off on returns', value: formatCurrency(cogsWrittenOff), tone: 'bad' },
				{ term: 'Units', value: formatNumber(overall.total_units) },
				{
					term: 'Cost per unit',
					value: formatCurrency(overall.total_units > 0 ? overall.cogs / overall.total_units : 0),
				},
			],
			footnote: 'Returned stock still costs you. How much of it you actually lose is set by the write-off rates in Expenses.',
		},
		{
			label: 'Ads spend',
			value: overall.ads_cost,
			format: formatCurrency,
			hint: 'Account-level, not per SKU',
			icon: MegaphoneIcon,
			meaning: 'What Meesho charged for ads across the whole account this period.',
			rows: [
				{ term: 'Total charged', value: formatCurrency(Math.abs(overall.ads_cost)), tone: 'bad' },
				{
					term: 'Share of settlement',
					value: formatPercent(
						overall.net_settlement !== 0
							? (Math.abs(overall.ads_cost) / overall.net_settlement) * 100
							: null,
					),
				},
				{
					term: 'Per order',
					value: formatCurrency(
						overall.total_orders > 0 ? Math.abs(overall.ads_cost) / overall.total_orders : 0,
					),
				},
			],
			footnote: 'It is not split per SKU because the payment file never says which listing an ad sold. So a SKU\'s profit below is before ads.',
		},
		{
			label: 'Business expenses',
			value: -overheads,
			format: formatCurrency,
			hint: overheads > 0 ? 'Rent, salary and bills for this period' : 'Not set yet — add them in Expenses',
			icon: BuildingIcon,
			meaning: 'Your fixed running costs — rent, salary, internet, electricity — prorated to the length of this payment period.',
			rows: [
				{ term: 'Total for this period', value: formatCurrency(overheads), tone: 'bad', when: overheads > 0 },
				{
					term: 'Per order',
					value: formatCurrency(overall.total_orders > 0 ? overheads / overall.total_orders : 0),
					when: overheads > 0,
				},
			],
			footnote:
				overheads > 0
					? 'These are charged whether you sell or not, which is why the headline profit is taken after them.'
					: 'Nothing entered yet, so the headline profit above is trading profit only — it does not yet pay your rent.',
		},
		{
			label: 'Orders',
			value: overall.total_orders,
			format: formatNumber,
			hint: `${formatNumber(overall.total_units)} units in them`,
			icon: ShoppingBagIcon,
			meaning: 'Every order in the payment file for this period, delivered or returned, and the units inside them.',
			rows: [
				{ term: 'Orders', value: formatNumber(overall.total_orders) },
				{ term: 'Units', value: formatNumber(overall.total_units) },
				{
					term: 'Units per order',
					value:
						overall.total_orders > 0
							? (overall.total_units / overall.total_orders).toFixed(2)
							: '—',
				},
				{ term: 'Settlement per order', value: formatCurrency(settlementPerOrder) },
			],
			footnote: 'An order is one parcel you packed; a unit is one thing you made. They differ whenever someone buys two.',
		},
	];

	return (
		<MetricTooltipProvider>
			<motion.div variants={RESULT_STAGGER} initial="hidden" animate="show" className="space-y-3">
				{/* The headline. Everything else on this screen exists to explain this one number, so it
				  * gets the size and the colour and the rest stay monochrome. */}
				<motion.section
					variants={RESULT_ITEM}
					className={cn(
						'relative overflow-hidden rounded-3xl border p-5 sm:p-6',
						positive
							? 'border-success/25 bg-success/[0.06]'
							: 'border-destructive/25 bg-destructive/[0.06]',
					)}
				>
					{/* A soft wash behind the figure rather than a solid fill — keeps the number readable
					  * in both themes while still reading green or red at a glance. */}
					<div
						aria-hidden="true"
						className={cn(
							'pointer-events-none absolute -right-12 -top-16 size-48 rounded-full blur-3xl',
							positive ? 'bg-success/20' : 'bg-destructive/20',
						)}
					/>

					<div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2.5">
								<p className="text-sm font-medium text-muted-foreground">Net profit</p>
								<motion.span
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ ...SPRING, delay: 0.15 }}
									className={cn(
										'relative inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums',
										positive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
									)}
								>
									{/* The cropper's one-shot "done" pulse, on the figure that is this
									  * tool's equivalent of "your labels are ready". Once, never looping. */}
									{[0, 0.15].map((delay) => (
										<motion.span
											key={delay}
											aria-hidden="true"
											className={cn(
												'pointer-events-none absolute inset-0 rounded-full',
												positive ? 'bg-success/25' : 'bg-destructive/25',
											)}
											initial={{ scale: 0.8, opacity: 0.8 }}
											animate={{ scale: 1.9, opacity: 0 }}
											transition={{ duration: 1.1, delay: 0.35 + delay, ease: 'easeOut' }}
										/>
									))}
									{positive ? (
										<TrendingUpIcon className="size-3.5" aria-hidden="true" />
									) : (
										<TrendingDownIcon className="size-3.5" aria-hidden="true" />
									)}
									{formatPercent(marginPct)} margin
								</motion.span>
							</div>

							{/* Proportional figures, not tabular. `tabular-nums` gives every digit the width
							  * of a zero, which is right in a column of numbers and wrong at display size —
							  * it made the one number the page is about look gappy and loose. */}
							<p
								className={cn(
									'mt-1 text-5xl font-bold tracking-tight sm:text-6xl',
									positive ? 'text-success' : 'text-destructive',
								)}
							>
								<AnimatedNumber value={realProfit} format={formatCurrency} />
							</p>

							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								kept from {formatCurrency(overall.net_settlement)} of settlement across{' '}
								{formatNumber(overall.total_orders)} orders
								{overheads > 0 && (
									<>
										{', after '}
										<span className="tabular-nums">{formatCurrency(overheads)}</span> of business
										expenses
									</>
								)}
							</p>

							{/* How much of the payout survived to profit, as a bar. The percentage above says the
							  * same thing, but a bar is read without arithmetic. */}
							<div className="mt-4">
								<ProgressMeter
									value={profitShare}
									className={cn('h-full rounded-full', positive ? 'bg-success' : 'bg-destructive')}
									trackClassName="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
								/>
								<p className="mt-2 text-sm text-muted-foreground">
									{positive
										? 'Share of your payout that stayed with you.'
										: 'You paid out more than you were settled for this period.'}
								</p>
							</div>
						</div>

						{/* The right third of this card used to be empty — a ₹8,556 headline floating in a
						  * quarter of the screen. Two figures live there instead: what an order is worth to
						  * you, and what Meesho charged you for the ones that came back. Per-unit profit used
						  * to sit in the second slot and, at roughly one unit an order, it only ever restated
						  * the first. The return fee is a number nothing else on this screen shows. */}
						<div
							className={cn(
								'grid shrink-0 grid-cols-2 overflow-hidden rounded-2xl border sm:w-48 sm:grid-cols-1',
								positive
									? 'border-success/20 bg-background/60'
									: 'border-destructive/20 bg-background/60',
							)}
						>
							<MiniStat
								label="Per order"
								value={perOrder}
								valueClass={positive ? 'text-success' : 'text-destructive'}
								borderClass={positive ? 'border-success/20' : 'border-destructive/20'}
								title="Profit per order"
								meaning="Your net profit divided by the number of orders — what one parcel, packed and shipped, is actually worth to you."
								rows={[
									{
										term: 'Net profit',
										value: formatCurrency(realProfit),
										tone: positive ? 'good' : 'bad',
									},
									{ term: 'Orders', value: formatNumber(overall.total_orders) },
									{ term: 'Settlement per order', value: formatCurrency(settlementPerOrder) },
								]}
								footnote="This is after ads and business expenses, so it is the figure to hold against the effort of packing one more."
							/>
							<MiniStat
								label="Return fee"
								value={returnFee}
								valueClass="text-foreground"
								borderClass={positive ? 'border-success/20' : 'border-destructive/20'}
								className="border-l sm:border-l-0 sm:border-t"
								title="Meesho return fee"
								meaning="The total reverse-shipping fee Meesho charged you this period for orders the customer returned or that came back undelivered."
								rows={[
									{ term: 'Total charged', value: formatCurrency(returnFee), tone: 'bad' },
									{
										term: 'Share of settlement',
										value: formatPercent(
											overall.net_settlement !== 0
												? (returnFee / overall.net_settlement) * 100
												: null,
										),
									},
									{
										term: 'Across all orders',
										value: formatCurrency(
											overall.total_orders > 0 ? returnFee / overall.total_orders : 0,
										),
									},
								]}
								footnote="Meesho takes this out before paying you, so it is already inside the settlement figure — it is not subtracted from your profit a second time."
							/>
						</div>
					</div>
				</motion.section>

				<div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
					{tiles.map((tile, index) => (
						<motion.div
							key={tile.label}
							variants={RESULT_ITEM}
							className={cn(
								'min-w-0',
								// Five tiles in two columns leaves the last one as a half-width orphan on a
								// phone. It takes the whole row instead.
								index === tiles.length - 1 && 'col-span-2 lg:col-span-1',
							)}
						>
							{/* The cropper's result tile: soft grey, big figure, small caption. Tapping
							  * one opens the working behind it, which is why it stays a button. */}
							<StatTile
								className="h-full px-3 py-3.5"
								label={
									<span className="inline-flex items-center gap-1.5">
										<tile.icon className="size-3.5 shrink-0" aria-hidden="true" />
										{tile.label}
									</span>
								}
								value={<AnimatedNumber value={tile.value} format={tile.format} />}
								hint={tile.hint}
								explain={{ title: tile.label, meaning: tile.meaning, rows: tile.rows, footnote: tile.footnote }}
							/>
						</motion.div>
					))}
				</div>
			</motion.div>
		</MetricTooltipProvider>
	);
}

/** One cell of the two-figure panel beside the headline. */
function MiniStat({
	label,
	value,
	valueClass,
	borderClass,
	className,
	title,
	meaning,
	rows,
	footnote,
}: {
	label: string;
	value: number;
	valueClass: string;
	borderClass: string;
	className?: string;
	title: string;
	meaning: string;
	rows: MetricRow[];
	footnote?: string;
}) {
	return (
		<div className={cn(borderClass, className)}>
			<MetricTooltip
				title={title}
				meaning={meaning}
				rows={rows}
				footnote={footnote}
				side="bottom"
				className="block w-full px-4 py-3 transition-colors hover:bg-foreground/[0.04]"
			>
				<span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{label}
				</span>
				{/* These two stack into a column on a laptop, so tabular figures are right here —
				  * the rupee signs and the digits line up under each other. */}
				<span className={cn('mt-1 block text-xl font-semibold tabular-nums tracking-tight', valueClass)}>
					<AnimatedNumber value={value} format={formatCurrency} />
				</span>
			</MetricTooltip>
		</div>
	);
}
