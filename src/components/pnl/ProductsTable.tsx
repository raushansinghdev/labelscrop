import { AlertTriangleIcon, ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { cn } from 'cn';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '@/components/ui/select';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { EASE_OUT } from './motion';
import type { SkuRow } from './types';

type SortDirection = 'desc' | 'asc';

interface SortOption {
	value: string;
	label: string;
	group: string;
	/**
	 * Null means "can't be computed for this SKU" — a margin with no settlement to divide by, a
	 * return rate with no orders. Those sort to the bottom whichever way the list points, because
	 * "unknown" is not the same as "worst" and shouldn't head the list when you flip to ascending.
	 */
	get: (row: SkuRow) => number | string | null;
	/** Text sorts read A–Z by default; every number reads biggest-first. */
	text?: boolean;
}

const SORT_OPTIONS: SortOption[] = [
	{ value: 'profit', label: 'Net profit', group: 'Profit', get: (r) => r.profit },
	{ value: 'margin_pct', label: 'Margin', group: 'Profit', get: (r) => r.margin_pct },
	{ value: 'net_settlement', label: 'Settlement', group: 'Profit', get: (r) => r.net_settlement },
	{ value: 'cogs', label: 'Item cost', group: 'Profit', get: (r) => r.cogs },

	{ value: 'orders', label: 'Orders', group: 'Volume', get: (r) => r.orders },
	{ value: 'units', label: 'Units', group: 'Volume', get: (r) => r.units },
	{ value: 'delivered_orders', label: 'Delivered', group: 'Volume', get: (r) => r.delivered_orders },

	{
		value: 'return_rate',
		label: 'Return rate',
		group: 'Returns',
		// Both kinds of return together, as a share of the SKU's own orders — the one figure that
		// compares a 6-order product against a 300-order one fairly.
		get: (r) => (r.orders > 0 ? ((r.rto_orders + r.return_orders) / r.orders) * 100 : null),
	},
	{ value: 'rto_orders', label: 'Courier returns', group: 'Returns', get: (r) => r.rto_orders },
	{ value: 'return_orders', label: 'Customer returns', group: 'Returns', get: (r) => r.return_orders },

	{ value: 'avg_sale_price', label: 'Listed price', group: 'Product', get: (r) => r.avg_sale_price },
	{
		value: 'product_name',
		label: 'Product name',
		group: 'Product',
		text: true,
		get: (r) => (r.product_name || r.sku).toLowerCase(),
	},
	{ value: 'sku', label: 'SKU', group: 'Product', text: true, get: (r) => r.sku.toLowerCase() },
];

const SORT_GROUPS = [...new Set(SORT_OPTIONS.map((o) => o.group))];

interface ProductsTableProps {
	rows: SkuRow[];
}

/**
 * How many cards are shown before the list asks. A seller with 39 SKUs was otherwise handed a
 * 10,800px scroll on a phone, and the cards past the first dozen are the long tail nobody reads
 * — sorting and search are how those get found, not scrolling.
 */
const PAGE_SIZE = 12;

export function ProductsTable({ rows }: ProductsTableProps) {
	const [query, setQuery] = useState('');
	const [sortKey, setSortKey] = useState('profit');
	const [direction, setDirection] = useState<SortDirection>('desc');
	const [showAll, setShowAll] = useState(false);

	const option = SORT_OPTIONS.find((o) => o.value === sortKey) ?? SORT_OPTIONS[0];

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const filtered = needle
			? rows.filter(
					(r) =>
						r.sku.toLowerCase().includes(needle) ||
						(r.product_name ?? '').toLowerCase().includes(needle),
				)
			: rows;

		return [...filtered].sort((a, b) => {
			const av = option.get(a);
			const bv = option.get(b);

			if (av === null || bv === null) {
				if (av === bv) return 0;
				return av === null ? 1 : -1;
			}

			// Compared ascending, then flipped — one ordering to reason about instead of two.
			const cmp =
				typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
			return direction === 'asc' ? cmp : -cmp;
		});
	}, [rows, query, option, direction]);

	const shown = showAll ? visible : visible.slice(0, PAGE_SIZE);
	const hidden = visible.length - shown.length;

	// Flipping to "lowest first" is usually the interesting half — the losing SKUs — so the label
	// says what you'll get, not which way an arrow points.
	const directionLabel = option.text
		? direction === 'asc'
			? 'A to Z'
			: 'Z to A'
		: direction === 'asc'
			? 'Lowest first'
			: 'Highest first';

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-2.5 sm:flex-row">
				<div className="relative flex-1">
					<span
						className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground"
						aria-hidden="true"
					>
						<SearchIcon className="size-4" />
					</span>
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search product or SKU"
						aria-label="Search products"
						className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-base outline-none transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 sm:text-sm"
					/>
				</div>

				<div className="flex gap-2.5">
					<Select
						value={sortKey}
						onValueChange={(next) => {
							if (next == null) return;
							const chosen = SORT_OPTIONS.find((o) => o.value === next);
							setSortKey(String(next));
							// Each key starts the way you'd expect to read it — names A–Z, everything else
							// biggest first — rather than inheriting the last key's direction.
							setDirection(chosen?.text ? 'asc' : 'desc');
						}}
					>
						<SelectTrigger
							aria-label="Sort products by"
							className="h-auto min-h-12 flex-1 gap-2 rounded-xl border-border bg-card px-3.5 text-sm transition-[border-color,background-color] hover:border-foreground/20 data-popup-open:border-primary sm:w-60 sm:flex-none"
						>
							<ArrowUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span className="min-w-0 flex-1 truncate text-left">
								<span className="text-muted-foreground">Sort by </span>
								<motion.span
									key={option.value}
									initial={{ opacity: 0, y: 3 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.2, ease: EASE_OUT }}
									className="inline-block font-medium"
								>
									{option.label}
								</motion.span>
							</span>
						</SelectTrigger>

						{/* Thirteen options run about 530px, which on a phone is the whole screen and on
						  * desktop covers most of the card grid behind it. Capped at 304px — nine-ish rows,
						  * with the next one cut so it reads as "there is more" — and Base UI scrolls the
						  * selected option into view on open, so a sort near the bottom isn't lost. */}
						<SelectContent
							alignItemWithTrigger={false}
							align="end"
							sideOffset={6}
							className="max-h-[min(19rem,var(--available-height))] w-auto min-w-(--anchor-width) rounded-2xl p-1.5 shadow-xl"
						>
							{SORT_GROUPS.map((group) => (
								<SelectGroup key={group} className="p-0 pt-2 first:pt-0">
									<SelectLabel className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
										{group}
									</SelectLabel>
									{SORT_OPTIONS.filter((o) => o.group === group).map((opt) => (
										<SelectItem
											key={opt.value}
											value={opt.value}
											// The prefix lives in the trigger; repeating "Sort by" on thirteen
											// rows under headings that already say "Profit" is just noise.
											className="min-h-10 cursor-pointer rounded-xl py-1.5 pl-2.5 pr-9 text-sm data-selected:bg-primary/[0.06] data-selected:font-medium"
										>
											{opt.label}
										</SelectItem>
									))}
								</SelectGroup>
							))}
						</SelectContent>
					</Select>

					<button
						type="button"
						onClick={() => setDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
						title={directionLabel}
						aria-label={`Sort order: ${directionLabel}. Activate to reverse.`}
						className={cn(
							'flex h-12 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground',
							'transition-colors hover:border-foreground/20 hover:text-foreground',
							'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
						)}
					>
						<AnimatePresence mode="wait" initial={false}>
							<motion.span
								key={direction}
								initial={{ opacity: 0, y: direction === 'desc' ? -6 : 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: direction === 'desc' ? 6 : -6 }}
								transition={{ duration: 0.15, ease: EASE_OUT }}
								className="flex flex-col items-center gap-0.5"
							>
								{direction === 'desc' ? (
									<ArrowDownIcon className="size-4" aria-hidden="true" />
								) : (
									<ArrowUpIcon className="size-4" aria-hidden="true" />
								)}
								{/* A bare arrow doesn't say which way round; the caption does, as in the cropper. */}
								<span className="text-[11px] leading-none font-semibold" aria-hidden="true">
									{option.text ? (direction === 'asc' ? 'A–Z' : 'Z–A') : direction === 'asc' ? 'Low' : 'High'}
								</span>
							</motion.span>
						</AnimatePresence>
					</button>
				</div>
			</div>

			{/* Stated once, here, rather than on 39 cards. Rent and salary are deliberately not
			  * divided between products — nothing about an order causes them, so any split would
			  * be invented — which makes it important to say what these figures do and don't carry. */}
			<p className="px-1 text-xs leading-relaxed text-muted-foreground">
				Profit per product is after its own making, packing and return costs — before business
				expenses like rent and salary.
			</p>

			{visible.length === 0 ? (
				<motion.p
					initial={{ opacity: 0, scale: 0.98 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.3, ease: EASE_OUT }}
					className="rounded-2xl border border-border bg-muted/30 px-4 py-12 text-center text-base text-muted-foreground"
				>
					No product matches “{query}”.
				</motion.p>
			) : (
				<ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
					<AnimatePresence initial={false}>
						{shown.map((row, index) => (
							<ProductCard key={row.sku} row={row} index={index} />
						))}
					</AnimatePresence>
				</ul>
			)}

			{hidden > 0 && (
				<button
					type="button"
					onClick={() => setShowAll(true)}
					className={cn(
						// The cropper's "Show all N SKUs" footer, standing on its own under the grid.
						'flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-sm font-semibold text-primary',
						'transition-colors hover:bg-muted/50 active:bg-muted/60',
						'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
					)}
				>
					Show {formatNumber(hidden)} more {hidden === 1 ? 'product' : 'products'}
					<ChevronDownIcon className="size-4" aria-hidden="true" />
				</button>
			)}
		</div>
	);
}

/**
 * One card per SKU, carrying the whole story: how it sold, how it ended up, and what was left.
 *
 * This replaced a full-width row with a single profit bar. The bar ranked products against each
 * other but said nothing about *why* one earned and another didn't — and "why" is almost always
 * the delivered-to-RTO split, which is now the middle of every card.
 */
function ProductCard({ row, index }: { row: SkuRow; index: number }) {
	const negative = row.profit < 0;
	const unitCost = row.units > 0 ? row.cogs / row.units : 0;

	// Orders that are neither delivered nor RTO nor returned — still shipping, cancelled, or a
	// blank status. Kept in the bar so the segments always add up to the total.
	const other = Math.max(0, row.orders - row.delivered_orders - row.rto_orders - row.return_orders);
	const segments = [
		{ key: 'delivered', count: row.delivered_orders, className: 'bg-success' },
		{ key: 'rto', count: row.rto_orders, className: 'bg-destructive' },
		{ key: 'return', count: row.return_orders, className: 'bg-chart-4' },
		{ key: 'other', count: other, className: 'bg-muted-foreground/30' },
	].filter((s) => s.count > 0);

	return (
		<motion.li
			layout
			initial={{ opacity: 0, y: 12 }}
			animate={{
				opacity: 1,
				y: 0,
				// Only the first screenful staggers; a 200-SKU list would otherwise take ten
				// seconds to finish arriving.
				transition: { duration: 0.35, ease: EASE_OUT, delay: Math.min(index, 8) * 0.03 },
			}}
			exit={{ opacity: 0, transition: { duration: 0.15 } }}
			// `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`, so without it the
			// longest product name sets the column width and the card runs off a phone screen
			// instead of truncating. It measured 885px wide in a 390px viewport.
			className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
		>
			{/* Profit sits in the header rather than at the foot of the card. It used to hang off the
			  * bottom under its own "Net profit" label, which cost two lines and put the one number
			  * worth scanning in a different place on every card, since the cards differ in height.
			  * Here it is always the top right corner, so the grid can be read down a column. */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<h3
						className="truncate text-base font-semibold leading-snug"
						title={row.product_name || row.sku}
					>
						{row.product_name || row.sku}
					</h3>
					<p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{row.sku}</p>
				</div>
				<div className="shrink-0 text-right">
					<p
						className={cn(
							'text-xl font-bold tabular-nums leading-tight tracking-tight',
							negative ? 'text-destructive' : 'text-success',
						)}
					>
						{formatCurrency(row.profit)}
					</p>
					<p
						className={cn(
							'text-sm font-semibold tabular-nums',
							negative ? 'text-destructive' : 'text-success',
						)}
					>
						{formatPercent(row.margin_pct)}
					</p>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap gap-1.5">
				<Chip className="bg-chart-1/10 text-chart-1">{formatCurrency(row.avg_sale_price)} listed</Chip>
				{row.cost_mapped ? (
					<Chip className="bg-muted text-muted-foreground">{formatCurrency(unitCost)} cost</Chip>
				) : (
					/* This used to be a three-line banner at the foot of the card, repeated on every
					 * uncosted SKU — which on a first run is nearly all of them. Same fact, one chip,
					 * in the row that already answers "what does this cost?". */
					<Chip
						className="flex items-center gap-1 bg-warning/15 text-warning"
						title="No cost recorded, so this product's profit is overstated."
					>
						<AlertTriangleIcon className="size-3.5" aria-hidden="true" />
						no cost
					</Chip>
				)}
			</div>

			<dl className="mt-3.5 grid grid-cols-4 gap-1.5 text-center">
				<Count label="Total" value={row.orders} />
				<Count label="Delivered" value={row.delivered_orders} className="text-success" />
				<Count label="Courier" value={row.rto_orders} className="text-destructive" />
				<Count label="Customer" value={row.return_orders} className="text-warning" />
			</dl>

			{/* The delivered / RTO / return split as one bar. The four numbers above say the same
			  * thing, but the bar is what makes a bad SKU obvious from across the grid. */}
			<div
				className="mt-2.5 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted"
				role="img"
				aria-label={`${row.delivered_orders} delivered, ${row.rto_orders} courier returns, ${row.return_orders} customer returns of ${row.orders} orders`}
			>
				{segments.map((segment) => (
					<motion.span
						key={segment.key}
						className={cn('h-full first:rounded-l-full last:rounded-r-full', segment.className)}
						initial={{ width: 0 }}
						animate={{ width: `${(segment.count / Math.max(1, row.orders)) * 100}%` }}
						transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.15 }}
					/>
				))}
			</div>

			<dl className="mt-auto space-y-1 border-t border-border pt-3 text-sm">
				<Line label="Settlement" value={formatCurrency(row.net_settlement)} />
				<Line label="Item cost" value={formatCurrency(row.cogs)} />
				{row.rto_cost > 0 && (
					<Line label="Courier return cost" value={formatCurrency(row.rto_cost)} className="text-destructive" />
				)}
			</dl>
		</motion.li>
	);
}

function Chip({
	className,
	title,
	children,
}: {
	className?: string;
	/** The long form of a chip that had to be shortened to stay out of the way. */
	title?: string;
	children: React.ReactNode;
}) {
	return (
		<span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', className)} title={title}>
			{children}
		</span>
	);
}

function Count({ label, value, className }: { label: string; value: number; className?: string }) {
	return (
		<div className="rounded-xl bg-muted/60 px-1 py-2">
			<dd className={cn('text-base font-semibold tabular-nums leading-tight', className)}>{formatNumber(value)}</dd>
			<dt className="mt-0.5 text-[11px] text-muted-foreground">{label}</dt>
		</div>
	);
}

function Line({ label, value, className }: { label: string; value: string; className?: string }) {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className={cn('font-medium tabular-nums', className)}>{value}</dd>
		</div>
	);
}
