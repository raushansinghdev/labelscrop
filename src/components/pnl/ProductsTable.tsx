import { AlertTriangleIcon, ArrowUpDownIcon, SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { cn } from 'cn';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { EASE_OUT } from './motion';
import type { SkuRow } from './types';

type SortKey = 'profit' | 'margin_pct' | 'orders' | 'net_settlement';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
	{ value: 'profit', label: 'Net profit' },
	{ value: 'margin_pct', label: 'Margin' },
	{ value: 'orders', label: 'Orders' },
	{ value: 'net_settlement', label: 'Settlement' },
];

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
	const [sortKey, setSortKey] = useState<SortKey>('profit');
	const [showAll, setShowAll] = useState(false);

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
			if (sortKey === 'margin_pct') {
				// SKUs with no computable margin sort last rather than pretending to be 0%.
				const av = a.margin_pct ?? Number.NEGATIVE_INFINITY;
				const bv = b.margin_pct ?? Number.NEGATIVE_INFINITY;
				return bv - av;
			}
			return b[sortKey] - a[sortKey];
		});
	}, [rows, query, sortKey]);

	const shown = showAll ? visible : visible.slice(0, PAGE_SIZE);
	const hidden = visible.length - shown.length;

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-2 sm:flex-row">
				<div className="relative flex-1">
					<SearchIcon
						className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search product or SKU"
						aria-label="Search products"
						className="h-10 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
					/>
				</div>

				<div className="relative">
					<ArrowUpDownIcon
						className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<select
						value={sortKey}
						onChange={(e) => setSortKey(e.target.value as SortKey)}
						aria-label="Sort products by"
						className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-border bg-background pl-8 pr-8 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-44"
					>
						{SORT_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								Sort by {opt.label}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Stated once, here, rather than on 39 cards. Rent and salary are deliberately not
			  * divided between products — nothing about an order causes them, so any split would
			  * be invented — which makes it important to say what these figures do and don't carry. */}
			<p className="text-[11px] text-muted-foreground">
				Profit per product is after its own making, packing and return costs — before business
				expenses like rent and salary.
			</p>

			{visible.length === 0 ? (
				<motion.p
					initial={{ opacity: 0, scale: 0.98 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.3, ease: EASE_OUT }}
					className="rounded-2xl border border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground"
				>
					No product matches “{query}”.
				</motion.p>
			) : (
				<ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
						'h-11 w-full rounded-lg border border-border text-[13px] font-medium sm:h-10',
						'transition-colors hover:bg-muted',
						'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
					)}
				>
					Show {formatNumber(hidden)} more {hidden === 1 ? 'product' : 'products'}
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
			className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20"
		>
			{/* Profit sits in the header rather than at the foot of the card. It used to hang off the
			  * bottom under its own "Net profit" label, which cost two lines and put the one number
			  * worth scanning in a different place on every card, since the cards differ in height.
			  * Here it is always the top right corner, so the grid can be read down a column. */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<h3
						className="truncate text-[13px] font-semibold leading-snug"
						title={row.product_name || row.sku}
					>
						{row.product_name || row.sku}
					</h3>
					<p className="truncate font-mono text-[11px] text-muted-foreground">{row.sku}</p>
				</div>
				<div className="shrink-0 text-right">
					<p
						className={cn(
							'text-lg font-bold tabular-nums leading-tight tracking-tight',
							negative ? 'text-destructive' : 'text-success',
						)}
					>
						{formatCurrency(row.profit)}
					</p>
					<p
						className={cn(
							'text-[11px] font-semibold tabular-nums',
							negative ? 'text-destructive' : 'text-success',
						)}
					>
						{formatPercent(row.margin_pct)}
					</p>
				</div>
			</div>

			<div className="mt-2 flex flex-wrap gap-1">
				<Chip className="bg-chart-1/10 text-chart-1">{formatCurrency(row.avg_sale_price)} listed</Chip>
				{row.cost_mapped ? (
					<Chip className="bg-muted text-muted-foreground">{formatCurrency(unitCost)} cost</Chip>
				) : (
					/* This used to be a three-line banner at the foot of the card, repeated on every
					 * uncosted SKU — which on a first run is nearly all of them. Same fact, one chip,
					 * in the row that already answers "what does this cost?". */
					<Chip
						className="flex items-center gap-1 bg-chart-4/15 text-chart-4"
						title="No cost recorded, so this product's profit is overstated."
					>
						<AlertTriangleIcon className="size-3" aria-hidden="true" />
						no cost
					</Chip>
				)}
			</div>

			<dl className="mt-2.5 grid grid-cols-4 gap-1 text-center">
				<Count label="Total" value={row.orders} />
				<Count label="Delivered" value={row.delivered_orders} className="text-success" />
				<Count label="RTO" value={row.rto_orders} className="text-destructive" />
				<Count label="Return" value={row.return_orders} className="text-chart-4" />
			</dl>

			{/* The delivered / RTO / return split as one bar. The four numbers above say the same
			  * thing, but the bar is what makes a bad SKU obvious from across the grid. */}
			<div
				className="mt-1.5 flex h-1 w-full gap-px overflow-hidden rounded-full bg-muted"
				role="img"
				aria-label={`${row.delivered_orders} delivered, ${row.rto_orders} returned to you, ${row.return_orders} customer returns of ${row.orders} orders`}
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

			<dl className="mt-auto space-y-0.5 border-t border-border pt-2.5 text-[11px]">
				<Line label="Settlement" value={formatCurrency(row.net_settlement)} />
				<Line label="Item cost" value={formatCurrency(row.cogs)} />
				{row.rto_cost > 0 && (
					<Line label="RTO cost" value={formatCurrency(row.rto_cost)} className="text-destructive" />
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
		<span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums', className)} title={title}>
			{children}
		</span>
	);
}

function Count({ label, value, className }: { label: string; value: number; className?: string }) {
	return (
		<div>
			<dd className={cn('text-sm font-semibold tabular-nums leading-tight', className)}>{formatNumber(value)}</dd>
			<dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</dt>
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
