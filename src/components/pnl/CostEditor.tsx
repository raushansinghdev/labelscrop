import {
	ArrowRightIcon,
	CheckIcon,
	DownloadIcon,
	FileSpreadsheetIcon,
	SearchIcon,
	UploadIcon,
	XIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatNumber } from './format';
import { EASE_OUT, ProgressMeter, SPRING } from './motion';
import { requestPersistentStorage } from './preferences';
import { StickyActions } from './StickyActions';
import type { SkuCostMap, SkuRow } from './types';

interface CostEditorProps {
	/** Every SKU seen in the payment files, so costs can be set before a SKU ever sells again. */
	rows: SkuRow[];
	/** Recompute the P&L once costs change; the parent owns the workbooks. */
	onCostsSaved: () => void;
	/**
	 * The primary action's label and destination. On the upload step this is "Save & analyse" and
	 * it opens the dashboard; on the dashboard's own Costs tab it is "Save & update".
	 */
	primaryLabel: string;
	onPrimary: () => void;
	/** Shown beside the primary action when there is somewhere sensible to go back to. */
	secondary?: { label: string; onClick: () => void };
}

interface Draft {
	making: string;
	packaging: string;
}

/**
 * One template for the heading row and every data row. They were separate strings once and drifted
 * apart, which put the values under the wrong headings — visibly wrong only if you measured.
 */
const COST_COLS = 'md:grid-cols-[minmax(0,1fr)_4.5rem_5.75rem_5.75rem_4.5rem]';

/** What one unit costs all in — the figure the P&L actually charges against each order. */
function unitTotal(draft: Draft): number {
	return (Number(draft.making) || 0) + (Number(draft.packaging) || 0);
}

export function CostEditor({ rows, onCostsSaved, primaryLabel, onPrimary, secondary }: CostEditorProps) {
	const [drafts, setDrafts] = useState<Record<string, Draft>>({});
	const [query, setQuery] = useState('');
	/**
	 * On by default, and it stays on. A returning seller has costs for nearly every SKU already, and
	 * the rows that still need one are the only reason to open this page — scanning 39 rows to find
	 * the 3 blanks is work the tool can do itself.
	 *
	 * An earlier version switched itself off when nothing was missing, so a finished list never
	 * looked like an empty one. The user asked for it to stay ticked regardless; the empty case is
	 * handled by saying so plainly instead, with one button to see the whole list.
	 */
	const [onlyMissing, setOnlyMissing] = useState(true);
	const [dirty, setDirty] = useState(false);
	const [justSaved, setJustSaved] = useState(false);
	const [askBackup, setAskBackup] = useState(false);
	const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	// The backup prompt is offered once per session, so it never becomes a speed bump on the
	// way to the dashboard for someone who saves twice.
	const backupOfferedRef = useRef(false);

	useEffect(() => {
		let cancelled = false;
		import('@/lib/pnl/skuCosts.js').then(({ loadCosts }) => {
			if (cancelled) return;
			const loaded = loadCosts() as SkuCostMap;
			// Saving recomputes the P&L, which hands back a fresh `rows` array and re-runs this
			// effect. Seed only SKUs we haven't got a draft for yet, otherwise unsaved edits
			// elsewhere in the list would be wiped.
			setDrafts((current) => {
				const next = { ...current };
				for (const row of rows) {
					if (next[row.sku]) continue;
					// A saved entry is shown even when it's zero — a real "₹0 packaging" must read
					// differently from "not entered yet", which is what an empty box means here.
					const saved = loaded[row.sku];
					next[row.sku] = saved
						? { making: String(saved.making_cost), packaging: String(saved.packaging_cost) }
						: { making: '', packaging: '' };
				}
				return next;
			});
		});
		return () => {
			cancelled = true;
		};
	}, [rows]);

	/**
	 * Ordered by volume, and deliberately not by profit.
	 *
	 * `rows` comes back re-sorted on every recompute, and saving a cost changes profit — so a
	 * profit-ordered table reshuffled itself under the cursor the moment a number was entered.
	 * Units don't move when costs change, so this order holds still while the seller types, and
	 * it puts the products worth costing first.
	 */
	const ordered = useMemo(
		() => [...rows].sort((a, b) => b.units - a.units || a.sku.localeCompare(b.sku)),
		[rows],
	);

	/** A cost is "entered" the moment it's in the box — waiting for a save to confirm it makes the
	 *  counter look broken while you type. */
	const hasCost = useCallback(
		(sku: string) => {
			const draft = drafts[sku];
			return Boolean(draft && (draft.making !== '' || draft.packaging !== ''));
		},
		[drafts],
	);

	const doneCount = ordered.filter((r) => hasCost(r.sku)).length;
	const missingCount = ordered.length - doneCount;
	const allDone = missingCount === 0 && ordered.length > 0;

	// Which SKUs "only missing" is hiding. Snapshotted when the filter goes on rather than read
	// live, so typing a cost doesn't make the row disappear from under the cursor.
	const [missingSnapshot, setMissingSnapshot] = useState<Set<string> | null>(null);
	// The snapshot can't be seeded in the initialiser: `drafts` is empty on first render and only
	// fills once the saved costs load, so every SKU would look missing and the default filter
	// would be a no-op for the rest of the session.
	const seededRef = useRef(false);

	useEffect(() => {
		if (seededRef.current || ordered.length === 0 || Object.keys(drafts).length === 0) return;
		seededRef.current = true;
		setMissingSnapshot(new Set(ordered.filter((r) => !hasCost(r.sku)).map((r) => r.sku)));
	}, [ordered, drafts, hasCost]);

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return ordered.filter((r) => {
			if (missingSnapshot && !missingSnapshot.has(r.sku)) return false;
			if (!needle) return true;
			return r.sku.toLowerCase().includes(needle) || (r.product_name ?? '').toLowerCase().includes(needle);
		});
	}, [ordered, query, missingSnapshot]);

	const setField = useCallback((sku: string, field: keyof Draft, value: string) => {
		setDrafts((d) => ({ ...d, [sku]: { ...(d[sku] ?? { making: '', packaging: '' }), [field]: value } }));
		setDirty(true);
		setJustSaved(false);
	}, []);

	/** Writes every row that has a number in it, in one pass. Returns how many landed. */
	async function saveAll(): Promise<number> {
		const { loadCosts, saveCosts } = await import('@/lib/pnl/skuCosts.js');
		const next = { ...(loadCosts() as SkuCostMap) };

		let written = 0;
		for (const row of rows) {
			const draft = drafts[row.sku];
			if (!draft) continue;
			const making = Number(draft.making || 0);
			const packaging = Number(draft.packaging || 0);
			// A row left completely blank is "not costed yet", not "costs zero" — writing it
			// would clear the unmapped warning while the profit stayed overstated.
			if (draft.making === '' && draft.packaging === '') continue;
			if (!Number.isFinite(making) || !Number.isFinite(packaging)) continue;
			next[row.sku] = { making_cost: making, packaging_cost: packaging };
			written += 1;
		}

		saveCosts(next);
		// Saving a cost is the first moment the seller has put something in this browser worth
		// keeping, so it's the right moment to ask to keep it. Fire and forget: a browser that
		// refuses, or has never heard of the API, changes nothing about the save that just landed.
		if (written > 0) void requestPersistentStorage();
		setDirty(false);
		setJustSaved(true);
		onCostsSaved();
		return written;
	}

	/** Save, then move on — the button the seller actually presses on the cost step. */
	async function saveAndContinue() {
		const written = await saveAll();
		// Costs live only in this browser, so the moment after saving is when a backup is worth
		// offering — the original app prompted here too. Offered once per session, and only when
		// something was actually written, so it never blocks the way through.
		if (written > 0 && !backupOfferedRef.current) {
			backupOfferedRef.current = true;
			setAskBackup(true);
			return;
		}
		onPrimary();
	}

	/** Closes the backup offer and carries on to wherever the primary action points. */
	function dismissBackup() {
		setAskBackup(false);
		onPrimary();
	}

	/**
	 * Writes every SKU in the payment files to a spreadsheet, pre-filled with whatever costs are
	 * already saved. Unlike the original — which exported only the SKUs that had costs — this
	 * doubles as a blank template, so a seller with a hundred SKUs can fill them in Excel and
	 * import them back rather than typing each one in here.
	 */
	async function exportToExcel() {
		try {
			const [{ loadCosts }, { generateCostsExcel, ensureXlsx }] = await Promise.all([
				import('@/lib/pnl/skuCosts.js'),
				import('@/lib/pnl/parser.js'),
			]);
			const saved = loadCosts() as SkuCostMap;
			const full: SkuCostMap = {};
			for (const row of rows) {
				full[row.sku] = saved[row.sku] ?? { making_cost: 0, packaging_cost: 0 };
			}
			const workbook = await generateCostsExcel(full);
			(await ensureXlsx()).writeFile(workbook, 'sku-costs.xlsx');
			setNotice({ kind: 'ok', text: `Saved sku-costs.xlsx with ${rows.length} SKUs.` });
		} catch (err) {
			setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not build the file.' });
		}
	}

	async function importFromExcel(file: File) {
		try {
			const [{ readExcelFile, parseCostsExcel }, { loadCosts, saveCosts }] = await Promise.all([
				import('@/lib/pnl/parser.js'),
				import('@/lib/pnl/skuCosts.js'),
			]);
			const imported = parseCostsExcel(await readExcelFile(file)) as SkuCostMap;
			const count = Object.keys(imported).length;
			if (count === 0) {
				throw new Error('No SKUs found. The sheet needs SKU CODE, MAKING COST and PACKAGING COST columns.');
			}

			// Merge rather than replace: a partial sheet should top up what's saved, not wipe
			// costs for SKUs the seller left out of it.
			saveCosts({ ...(loadCosts() as SkuCostMap), ...imported });

			// Drafts are only seeded for SKUs that don't have one, so imported values would stay
			// hidden behind the old inputs. Clearing them lets the effect reseed from storage.
			setDrafts({});
			setDirty(false);
			setNotice({ kind: 'ok', text: `Imported costs for ${count} SKUs.` });
			onCostsSaved();
		} catch (err) {
			setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not read that file.' });
		}
	}

	return (
		<div className="space-y-3">
			<section className="overflow-hidden rounded-2xl border border-border bg-card">
				<header className="flex flex-col gap-3 border-b border-border p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
					<div className="min-w-0">
						<h2 className="text-sm font-semibold tracking-tight">Product costs</h2>
						<p className="mt-0.5 text-xs text-muted-foreground">
							What one unit costs you to make and to pack ·{' '}
							<span className={cn('font-semibold', allDone ? 'text-success' : 'text-foreground')}>
								{doneCount}/{rows.length} entered
							</span>
						</p>
					</div>

					<div className="flex shrink-0 flex-wrap gap-2">
						<SecondaryButton icon={UploadIcon} onClick={() => fileInputRef.current?.click()}>
							Import costs
						</SecondaryButton>
						<SecondaryButton icon={DownloadIcon} onClick={() => void exportToExcel()}>
							Export
						</SecondaryButton>
						<input
							ref={fileInputRef}
							type="file"
							accept=".xlsx,.xls"
							className="sr-only"
							onChange={(e) => {
								const picked = e.target.files?.[0];
								// Cleared first: re-picking the same file fires no change event otherwise.
								e.target.value = '';
								if (picked) void importFromExcel(picked);
							}}
						/>
					</div>
				</header>

				<div className="px-3.5 pt-2.5 sm:px-4">
					<ProgressMeter
						value={rows.length > 0 ? doneCount / rows.length : 0}
						className={cn('h-full rounded-full', allDone ? 'bg-success' : 'bg-primary')}
					/>
				</div>

				<AnimatePresence>
					{notice && (
						<motion.div
							role="status"
							aria-live="polite"
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={{ opacity: 0, height: 0 }}
							className="overflow-hidden px-4 sm:px-5"
						>
							<p
								className={cn(
									'mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs',
									notice.kind === 'error'
										? 'bg-destructive/10 text-destructive'
										: 'bg-success/10 text-foreground',
								)}
							>
								{notice.text}
								<button
									type="button"
									onClick={() => setNotice(null)}
									aria-label="Dismiss"
									className="shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
								>
									<XIcon className="size-3.5" />
								</button>
							</p>
						</motion.div>
					)}
				</AnimatePresence>

				<div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:p-4">
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
					<label
						className={cn(
							'flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors sm:h-9',
							onlyMissing
								? 'border-primary/40 bg-primary/10 text-foreground'
								: 'border-border hover:bg-muted',
						)}
					>
						<input
							type="checkbox"
							checked={onlyMissing}
							onChange={(e) => {
								setOnlyMissing(e.target.checked);
								setMissingSnapshot(
									e.target.checked
										? new Set(ordered.filter((r) => !hasCost(r.sku)).map((r) => r.sku))
										: null,
								);
							}}
							className="size-4 accent-[var(--primary)]"
						/>
						Only missing
						{missingCount > 0 && (
							<span className="tabular-nums text-muted-foreground">({missingCount})</span>
						)}
					</label>
				</div>

				{visible.length === 0 ? (
					<EmptyTable
						query={query}
						filtered={onlyMissing}
						total={ordered.length}
						onShowAll={() => {
							setOnlyMissing(false);
							setMissingSnapshot(null);
						}}
					/>
				) : (
					<>
						{/* Two copies of the heading row, one per column. */}
						<div aria-hidden="true" className="hidden border-y border-border bg-muted/40 md:block">
							<div className="lg:grid lg:grid-cols-2">
								<HeadRow />
								<HeadRow className="hidden lg:grid lg:border-l lg:border-border" />
							</div>
						</div>

						{/* Two columns of rows on a laptop, one on a phone.
						  *
						  * Dropping the product name freed roughly half the width, and a 39-SKU list is the
						  * kind of thing a seller works down in one sitting — halving the scroll is worth more
						  * here than a title nobody enters costs by. The name survives as the SKU cell's
						  * `title`, so it's one hover away when a code isn't enough.
						  *
						  * Rows flow across before they flow down, which keeps tab order matching reading
						  * order — a column-major fill would send the cursor from row 1 to row 21. */}
						<ul className="border-t border-border md:border-t-0 lg:grid lg:grid-cols-2">
							<AnimatePresence initial={false}>
								{visible.map((row) => {
									const draft = drafts[row.sku] ?? { making: '', packaging: '' };
									const filled = hasCost(row.sku);
									return (
										<motion.li
											key={row.sku}
											layout
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.2, ease: EASE_OUT }}
											className={cn(
												'border-b border-border px-4 py-2.5 transition-colors',
												'md:grid md:items-center md:gap-2.5 md:py-1.5',
												COST_COLS,
												// The left-hand column needs a rule down its right edge; only the
												// odd-numbered rows land there once the list flows across.
												'lg:odd:border-r lg:odd:border-border',
												filled ? 'bg-success/[0.04]' : 'hover:bg-muted/40',
											)}
										>
											{/* SKU and listing price share a line on a phone and become two
											  * columns on a laptop. The title carries the full product name,
											  * which no longer has a column of its own. */}
											<div className="flex items-baseline justify-between gap-2 md:contents">
												<p
													className="min-w-0 truncate font-mono text-[13px] font-semibold"
													title={row.product_name || row.sku}
												>
													{row.sku}
												</p>
												<span className="shrink-0 text-[11px] tabular-nums text-muted-foreground md:text-right md:text-[13px]">
													{formatCurrency(row.avg_sale_price)}
													<span className="md:sr-only"> listed</span>
												</span>
											</div>

											<div className="mt-1.5 flex items-center gap-2 md:mt-0 md:contents">
												<CostField
													label={`Making cost for ${row.product_name || row.sku}`}
													placeholder="Making"
													value={draft.making}
													onChange={(v) => setField(row.sku, 'making', v)}
													className="flex-1 md:w-full md:flex-none"
												/>
												<CostField
													label={`Packing cost for ${row.product_name || row.sku}`}
													placeholder="Packing"
													value={draft.packaging}
													onChange={(v) => setField(row.sku, 'packaging', v)}
													className="flex-1 md:w-full md:flex-none"
												/>
												{/* The sum, echoed back. It is the number that actually reaches
												  * the P&L, and seeing it land is how a typo in the packing box
												  * gets caught here rather than three screens later, in a profit
												  * figure that just looks slightly off. */}
												<p
													className={cn(
														'w-14 shrink-0 text-right text-[13px] tabular-nums md:w-full',
														filled ? 'font-semibold' : 'text-muted-foreground',
													)}
												>
													{filled ? formatCurrency(unitTotal(draft)) : '—'}
												</p>
											</div>
										</motion.li>
									);
								})}
							</AnimatePresence>
						</ul>
					</>
				)}
			</section>

			{/* The way onward, pinned to the bottom of a phone screen and sitting at the end of the
			  * panel on anything larger — exactly like the old app, which put it bottom right. */}
			<StickyActions
				label={primaryLabel}
				onClick={() => void saveAndContinue()}
				icon={justSaved && !dirty ? CheckIcon : ArrowRightIcon}
				secondary={secondary}
			/>

			<Dialog open={askBackup} onOpenChange={(open) => !open && dismissBackup()}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						{/* The icon carries the tone. Green, not amber: nothing has gone wrong, and a
						  * warning colour here would read as an error the seller had just caused. */}
						<motion.span
							initial={{ scale: 0.6, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={SPRING}
							className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-success/12 text-success"
							aria-hidden="true"
						>
							<CheckIcon className="size-5" strokeWidth={2.5} />
						</motion.span>
						<DialogTitle>Costs saved</DialogTitle>
						<DialogDescription>
							They live in this browser only. Keep a spreadsheet copy and you can import it into
							next month's payment file in one click — or onto another device.
						</DialogDescription>
					</DialogHeader>

					{/* What the file actually is, so "Download backup" isn't a leap of faith. */}
					<div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
						<FileSpreadsheetIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
						<div className="min-w-0 flex-1">
							<p className="truncate font-mono text-xs font-medium">sku-costs.xlsx</p>
							<p className="text-[11px] text-muted-foreground">
								{formatNumber(rows.length)} products · opens in Excel
							</p>
						</div>
					</div>

					{/* Every route out of this dialog continues to the next step. An earlier version only
					  * did so from `onOpenChange`, which the footer buttons bypassed by setting state
					  * directly — so "Not now" saved the costs and then stranded the seller here with no
					  * visible sign anything had happened. */}
					<DialogFooter>
						<button
							type="button"
							onClick={dismissBackup}
							className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							Skip
						</button>
						<motion.button
							type="button"
							whileTap={{ scale: 0.98 }}
							transition={SPRING}
							onClick={() => {
								void exportToExcel();
								dismissBackup();
							}}
							className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							<DownloadIcon className="size-4" aria-hidden="true" />
							Download backup
						</motion.button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

/**
 * What the table says when it has nothing to show.
 *
 * Two quite different silences: a search that matched nothing, and a filter hiding every row
 * because there is nothing left to fill in. The second is good news, and as a bare line of grey
 * text in an empty panel it read like the tool had lost the seller's work.
 */
function EmptyTable({
	query,
	filtered,
	total,
	onShowAll,
}: {
	query: string;
	filtered: boolean;
	total: number;
	onShowAll: () => void;
}) {
	if (query.trim() || !filtered) {
		return (
			<p className="px-4 pb-6 text-center text-sm text-muted-foreground">
				No product matches “{query}”.
			</p>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: EASE_OUT }}
			className="flex flex-col items-center px-4 pb-6 pt-1 text-center"
		>
			<motion.span
				initial={{ scale: 0.6, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={SPRING}
				className="flex size-10 items-center justify-center rounded-full bg-success/12 text-success"
				aria-hidden="true"
			>
				<CheckIcon className="size-5" strokeWidth={2.5} />
			</motion.span>
			<p className="mt-2 text-sm font-semibold">Every product has a cost</p>
			<p className="mt-0.5 text-xs text-muted-foreground">
				All {formatNumber(total)} of them — your profit is working from real numbers.
			</p>
			<button
				type="button"
				onClick={onShowAll}
				className="mt-2.5 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				Show all {formatNumber(total)} products
			</button>
		</motion.div>
	);
}

function HeadRow({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				'grid items-center gap-2.5 px-4 py-1.5',
				'text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
				COST_COLS,
				className,
			)}
		>
			<span>SKU</span>
			<span className="text-right">Listing ₹</span>
			<span className="text-right">Making ₹</span>
			<span className="text-right">Packing ₹</span>
			<span className="text-right">Total ₹</span>
		</div>
	);
}

function SecondaryButton({
	icon: Icon,
	onClick,
	children,
}: {
	icon: typeof DownloadIcon;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium sm:h-8 sm:px-2.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			<Icon className="size-3.5" aria-hidden="true" />
			{children}
		</button>
	);
}

function CostField({
	label,
	value,
	onChange,
	placeholder,
	className,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}) {
	return (
		<div className={cn('relative', className ?? 'w-28')}>
			<span
				className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
				aria-hidden="true"
			>
				₹
			</span>
			<input
				type="number"
				inputMode="decimal"
				min="0"
				step="0.01"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder ?? '—'}
				aria-label={label}
				className="h-10 w-full rounded-md border border-border bg-background pl-5 pr-2 text-right text-[13px] md:h-8 tabular-nums outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring md:placeholder:text-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				style={{ MozAppearance: 'textfield' }}
			/>
		</div>
	);
}
