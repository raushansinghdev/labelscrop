import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	FileSpreadsheetIcon,
	LayoutDashboardIcon,
	Loader2Icon,
	PackageIcon,
	SlidersHorizontalIcon,
	TagsIcon,
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { StepIndicator } from '@/components/tool/StepIndicator';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ChartsBoundary } from './ChartsBoundary';
import { DownloadReport } from './DownloadReport';
import { CostEditor } from './CostEditor';
import { DEFAULT_EXPENSES, totalProrated, windowDays, type ExpenseRow } from './expenses';
import { ExpensesPanel } from './ExpensesPanel';
import { FilePathGuide } from './FilePathGuide';
import { formatDateRange, formatNumber } from './format';
import { KpiCards } from './KpiCards';
import { EASE_OUT, STAGE_TRANSITION, STAGGER_ITEM, STAGGER_LIST } from './motion';
import { PaymentFileDropzone, type PaymentFile } from './PaymentFileDropzone';
import { loadExpenses, loadLossRates, saveExpenses, saveLossRates } from './preferences';
import { ProductsTable } from './ProductsTable';
import { ProfitInsights } from './ProfitInsights';
import { TabBar, type TabDef } from './TabBar';
import type { LossRates, PnlResult } from './types';

// recharts is far larger than the rest of this island put together, and nobody sees a chart
// before they've uploaded a file — so it loads on demand rather than with the page.
const ProfitCharts = lazy(() => import('./charts'));

const DEFAULT_LOSS_RATES: LossRates = {
	rto: 0,
	return_rate: 1,
	lost: 1,
	unresolved: 0,
	rto_packaging_loss: 1,
	return_packaging_loss: 1,
};

/**
 * Three stages, in the order the question is actually answered: what did Meesho pay me, what did
 * it cost me to make, and therefore what did I keep.
 *
 * Costs are a *stage* rather than a tab on the dashboard because profit without them is just
 * settlement — the first version showed a confident green ₹59,504 at 83.7% margin before a single
 * cost had been entered, which is not an incomplete answer but a wrong one. Nobody reaches the
 * dashboard without passing through the cost table now.
 *
 * Expenses follow costs for the same reason and in that order: rent and salary are what turns
 * "profit on paper" into what actually reaches the seller, and Meesho's reporting has no idea
 * they exist. The return write-off rates share that screen, because they are a refinement of the
 * cost just entered. Both stay reachable as tabs afterwards — changing them is the main reason
 * to come back.
 */
const STEPS = ['Upload', 'Costs', 'Expenses', 'Profit'] as const;
type Stage = 'upload' | 'costs' | 'expenses' | 'dashboard';
const STAGE_STEP: Record<Stage, number> = { upload: 0, costs: 1, expenses: 2, dashboard: 3 };

type Status = 'idle' | 'working' | 'error';
type Tab = 'overview' | 'products' | 'costs' | 'expenses';

const TABS: TabDef<Tab>[] = [
	{ value: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
	{ value: 'products', label: 'Products', icon: PackageIcon },
	{ value: 'costs', label: 'Costs', icon: TagsIcon },
	{ value: 'expenses', label: 'Expenses', icon: SlidersHorizontalIcon },
];

const TAB_ORDER: Tab[] = TABS.map((t) => t.value);

let fileSeq = 0;

export function ProfitToolApp() {
	const [files, setFiles] = useState<PaymentFile[]>([]);
	const [stage, setStage] = useState<Stage>('upload');
	const [status, setStatus] = useState<Status>('idle');
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<PnlResult | null>(null);
	const [lossRates, setLossRates] = useState<LossRates>(DEFAULT_LOSS_RATES);
	const [expenses, setExpenses] = useState<ExpenseRow[]>(DEFAULT_EXPENSES);
	const [tab, setTab] = useState<Tab>('overview');
	// Which way the panel should slide. Derived from the tab order, so moving rightwards through
	// the row moves the content rightwards too and the tabs read as a sequence.
	const [direction, setDirection] = useState(1);

	// Loss rates are read back on mount rather than in the initialiser: this island is rendered on
	// the server too, where there is no localStorage. A seller who set these last month should not
	// have to set them again, so they are the one piece of state that outlives the session.
	useEffect(() => {
		setLossRates(loadLossRates(DEFAULT_LOSS_RATES));
		setExpenses(loadExpenses());
	}, []);

	/*
	 * Each step starts at the top of the tool, not wherever the last one ended.
	 *
	 * The page above the island is 500px of heading, promise and trust chips on a phone — fine
	 * before a file is picked, and dead weight every time after. Without this, finishing the cost
	 * table drops the seller into the middle of the expenses panel, or leaves the profit figure they
	 * just asked for sitting above the fold they are looking at. `scroll-mt-20` on the wrapper keeps
	 * the sticky site header off it.
	 */
	const rootRef = useRef<HTMLDivElement>(null);
	const firstStageRef = useRef(true);
	useEffect(() => {
		if (firstStageRef.current) {
			// Not on mount: arriving at a page that scrolls itself is disorienting, and on this one
			// it would also scroll the explanation of what the tool is out of view.
			firstStageRef.current = false;
			return;
		}
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		rootRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
	}, [stage]);

	// The parsed workbooks are kept so editing SKU costs or loss rates can recompute without
	// re-reading the files. They're opaque objects nothing renders from, so a ref avoids
	// re-rendering the island every time they're set.
	const workbooksRef = useRef<unknown[]>([]);

	const goToTab = useCallback(
		(next: Tab) => {
			setDirection(TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(tab) ? 1 : -1);
			setTab(next);
		},
		[tab],
	);

	const runCompute = useCallback(async (workbooks: unknown[], rates: LossRates) => {
		const { computePnl } = await import('@/lib/pnl/calculator.js');
		return (await computePnl(workbooks, null, rates)) as PnlResult;
	}, []);

	const addFiles = useCallback((incoming: File[]) => {
		setError(null);
		setStatus('idle');
		setFiles((current) => [...current, ...incoming.map((file) => ({ id: `f${++fileSeq}`, file }))]);
	}, []);

	const removeFile = useCallback((id: string) => {
		setFiles((current) => current.filter((f) => f.id !== id));
	}, []);

	const calculate = useCallback(async () => {
		if (files.length === 0) return;
		setStatus('working');
		setError(null);

		try {
			// Pulls in SheetJS on first use, so it's imported here rather than at the top of the
			// island — the upload screen shouldn't pay for the parser.
			const { readExcelFile } = await import('@/lib/pnl/parser.js');
			const workbooks = [];
			for (const entry of files) {
				workbooks.push(await readExcelFile(entry.file));
			}
			workbooksRef.current = workbooks;

			setResult(await runCompute(workbooks, lossRates));
			setStatus('idle');
			setStage('costs');
		} catch (err) {
			// The parser throws deliberately-worded messages for the two common failures (wrong
			// file, missing sheet); anything else is unexpected and shown verbatim.
			setError(err instanceof Error ? err.message : 'Could not read those files.');
			setStatus('error');
		}
	}, [files, lossRates, runCompute]);

	/** Re-runs the P&L against the files already in memory, after costs or loss rates change. */
	const recompute = useCallback(
		async (rates: LossRates = lossRates) => {
			if (workbooksRef.current.length === 0) return;
			try {
				setResult(await runCompute(workbooksRef.current, rates));
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Could not recalculate.');
				setStatus('error');
			}
		},
		[lossRates, runCompute],
	);

	/**
	 * Expenses need no recompute: they are subtracted from the finished P&L rather than fed into
	 * it, precisely because rent belongs to no order. Saving on every keystroke is cheap and means
	 * a seller who closes the tab mid-edit loses nothing.
	 */
	const handleExpensesChange = useCallback((next: ExpenseRow[]) => {
		setExpenses(next);
		saveExpenses(next);
	}, []);

	const handleLossRatesChange = useCallback(
		(next: LossRates) => {
			setLossRates(next);
			saveLossRates(next);
			void recompute(next);
		},
		[recompute],
	);

	const reset = useCallback(() => {
		workbooksRef.current = [];
		setFiles([]);
		setResult(null);
		setError(null);
		setStatus('idle');
		setTab('overview');
		setStage('upload');
	}, []);

	// How much of a month this file covers, and therefore the share of the monthly expenses that
	// belongs to it.
	const expenseDays = windowDays(
		result?.overall.payment_window_start,
		result?.overall.payment_window_end,
	);
	const overheads = result ? totalProrated(expenses, expenseDays) : 0;

	const unmappedCount = result?.unmapped_skus.length ?? 0;
	const tabs = TABS.map((t) => (t.value === 'costs' ? { ...t, badge: unmappedCount } : t));
	const fileLabel = files.length === 1 ? files[0].file.name : `${files.length} payment files`;

	/** Panels enter from whichever side the tab they replaced sits on. */
	const panelMotion = {
		initial: { opacity: 0, x: direction * 20 },
		animate: { opacity: 1, x: 0 },
		transition: { duration: 0.32, ease: EASE_OUT },
	};

	return (
		<MotionConfig reducedMotion="user">
			<div ref={rootRef} className="scroll-mt-20">
				{/* Always visible, including on the empty upload screen. An earlier version hid it
				  * until a file was loaded, on the theory that "step 1 of 4" with nothing done yet
				  * is a promise of work rather than a sense of progress. The user disagreed, and
				  * they're right for the reason that matters more: the label cropper shows its path
				  * from the first screen, and two tools on one site that disagree about where the
				  * path lives is a worse problem than a slightly over-eager step indicator. It also
				  * tells a first-time seller how much is ahead of them before they commit a file. */}
				<StepIndicator
					steps={STEPS}
					current={STAGE_STEP[stage]}
					onStepClick={(index) => {
						if (index === 0) reset();
						if (index === 1) setStage('costs');
						if (index === 2) setStage('expenses');
					}}
				/>

				<AnimatePresence mode="wait">
					{stage === 'upload' && (
						<motion.div
							key="upload"
							{...STAGE_TRANSITION}
							// The stage re-narrows itself: the page around it is wide for the tables
							// that come later, but an empty dropzone at 1152px is a barn door. Matches
							// the label cropper's upload column so the two tools feel like one site.
							className="mx-auto mt-6 max-w-xl space-y-3 sm:mt-8"
						>
							<PaymentFileDropzone
								files={files}
								onFilesAdded={addFiles}
								onRemove={removeFile}
								disabled={status === 'working'}
							/>

							{/* Only while the dropzone is empty. The question it answers — which of the
							  * panel's five downloads is the right one — stops existing the moment a file
							  * is picked, and leaving it there would push Continue down the screen. */}
							<AnimatePresence>{files.length === 0 && <FilePathGuide />}</AnimatePresence>

							<AnimatePresence>
								{files.length > 0 && (
									<motion.div
										layout
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -6 }}
										transition={{ duration: 0.3, ease: EASE_OUT }}
									>
										<button
											type="button"
											onClick={() => void calculate()}
											disabled={status === 'working'}
											className={cn(
												'group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6',
												'text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25',
												'transition-[transform,box-shadow] duration-200 hover:scale-[1.01] hover:shadow-xl hover:shadow-primary/30 active:scale-[0.99]',
												'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
												'disabled:pointer-events-none disabled:opacity-70',
											)}
										>
											{status === 'working' ? (
												<>
													<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
													Reading your {files.length === 1 ? 'file' : 'files'}…
												</>
											) : (
												<>
													Continue
													<ArrowRightIcon
														className="size-5 transition-transform duration-200 group-hover:translate-x-1"
														aria-hidden="true"
													/>
												</>
											)}
										</button>
									</motion.div>
								)}
							</AnimatePresence>

							<AnimatePresence>
								{status === 'error' && error && (
									<motion.div
										role="alert"
										initial={{ opacity: 0, y: -6 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0 }}
										className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
									>
										<AlertTriangleIcon
											className="mt-0.5 size-4 shrink-0 text-destructive"
											aria-hidden="true"
										/>
										<div>
											<p className="font-medium text-destructive">Couldn't read that</p>
											<p className="mt-1 text-muted-foreground">{error}</p>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</motion.div>
					)}

					{stage === 'costs' && result && (
						<motion.div key="costs" {...STAGE_TRANSITION} className="mt-6 space-y-3 sm:mt-8">
							<FileSummary
								fileLabel={fileLabel}
								orders={result.overall.total_orders}
								products={result.sku_rows.length}
								period={formatDateRange(
									result.overall.payment_window_start,
									result.overall.payment_window_end,
								)}
							/>

							<CostEditor
								rows={result.sku_rows}
								onCostsSaved={() => void recompute()}
								primaryLabel="Save & continue"
								onPrimary={() => setStage('expenses')}
								secondary={{ label: 'Start over', onClick: reset }}
							/>
						</motion.div>
					)}

					{stage === 'expenses' && result && (
						<motion.div key="expenses" {...STAGE_TRANSITION} className="mx-auto mt-6 max-w-4xl space-y-3 sm:mt-8">
							<FileSummary
								fileLabel={fileLabel}
								orders={result.overall.total_orders}
								products={result.sku_rows.length}
								period={formatDateRange(
									result.overall.payment_window_start,
									result.overall.payment_window_end,
								)}
							/>

							<ExpensesPanel
								rows={expenses}
								onChange={handleExpensesChange}
								lossRates={lossRates}
								onLossRatesChange={handleLossRatesChange}
								days={windowDays(
									result.overall.payment_window_start,
									result.overall.payment_window_end,
								)}
								onDone={() => {
									setStage('dashboard');
									setTab('overview');
								}}
								secondary={{ label: 'Back to costs', onClick: () => setStage('costs') }}
							/>
						</motion.div>
					)}

					{stage === 'dashboard' && result && (
						<motion.div key="dashboard" {...STAGE_TRANSITION} className="mt-6 space-y-3 sm:mt-8">
							<div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
								<FileSpreadsheetIcon className="size-4 shrink-0 text-chart-2" aria-hidden="true" />
								<div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
									<p className="truncate text-sm font-medium">{fileLabel}</p>
									<p className="truncate text-sm text-muted-foreground">
										{formatDateRange(
											result.overall.payment_window_start,
											result.overall.payment_window_end,
										)}
									</p>
								</div>
								<button
									type="button"
									onClick={reset}
									className={cn(
										'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5',
										'text-xs font-medium transition-colors hover:bg-muted',
										'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
									)}
								>
									<ArrowLeftIcon className="size-3.5" aria-hidden="true" />
									<span className="hidden sm:inline">New file</span>
									<span className="sr-only sm:hidden">Start over with a new file</span>
								</button>
							</div>

							<Tabs value={tab} onValueChange={(next) => goToTab(next as Tab)}>
								{/* Pinned under the site header on a phone. The costs tab is 5,800px tall
								  * and the products tab nearly as much — without this, switching tabs means
								  * scrolling back to the top first, which is the kind of thing that makes a
								  * tool feel like a document. `top-16` clears the 64px header exactly. */}
								<div className="sticky top-16 z-30 -mx-4 bg-background/90 px-4 py-1.5 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
									<TabBar tabs={tabs} active={tab} />
								</div>

								<TabsContent value="overview" className="pt-3">
									<motion.div key="overview" {...panelMotion} className="space-y-4">
										<KpiCards overall={result.overall} overheads={overheads} />

										<AnimatePresence>
											{unmappedCount > 0 && (
												<motion.button
													type="button"
													onClick={() => goToTab('costs')}
													initial={{ opacity: 0, height: 0 }}
													animate={{ opacity: 1, height: 'auto' }}
													exit={{ opacity: 0, height: 0 }}
													className={cn(
														'flex w-full items-center gap-3 rounded-xl border border-chart-4/30 bg-chart-4/10 px-4 py-3 text-left',
														'transition-colors hover:bg-chart-4/15',
														'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
													)}
												>
													<AlertTriangleIcon
														className="size-5 shrink-0 text-chart-4"
														aria-hidden="true"
													/>
													<span className="min-w-0 flex-1 text-sm">
														<strong className="font-semibold">
															{unmappedCount}{' '}
															{unmappedCount === 1 ? 'product has' : 'products have'} no
															cost recorded
														</strong>
														<span className="block text-muted-foreground">
															The profit above is overstated until you add them.
														</span>
													</span>
													<ArrowRightIcon
														className="size-4 shrink-0 text-muted-foreground"
														aria-hidden="true"
													/>
												</motion.button>
											)}
										</AnimatePresence>

										{/* Between the totals and the charts, because it answers the question the
									  * totals provoke: fine, but which product? Each card explains its own
									  * arithmetic on hover; the trip to the full table is offered once, from
									  * the SKU chart below. */}
									<ProfitInsights result={result} />

									<ChartsBoundary>
											<Suspense fallback={<ChartsFallback />}>
												<ProfitCharts
													result={result}
													overheads={overheads}
													onOpenProducts={() => goToTab('products')}
												/>
											</Suspense>
										</ChartsBoundary>

										{/* Last, deliberately. Everything above is the answer; this is the
										  * offer to keep it, and it only makes sense to someone who has
										  * read what they would be keeping. */}
										<DownloadReport
											result={result}
											overheads={overheads}
											expenses={expenses}
											expenseDays={expenseDays}
											fileNames={files.map((f) => f.file.name)}
										/>
									</motion.div>
								</TabsContent>

								<TabsContent value="products" className="pt-3">
									<motion.div key="products" {...panelMotion}>
										<ProductsTable rows={result.sku_rows} />
									</motion.div>
								</TabsContent>

								<TabsContent value="costs" className="pt-3">
									<motion.div key="costs" {...panelMotion}>
										<CostEditor
											rows={result.sku_rows}
											onCostsSaved={() => void recompute()}
											primaryLabel="Save & update profit"
											onPrimary={() => goToTab('overview')}
										/>
									</motion.div>
								</TabsContent>

								<TabsContent value="expenses" className="pt-3">
									<motion.div key="expenses" {...panelMotion}>
										<ExpensesPanel
											rows={expenses}
											onChange={handleExpensesChange}
											lossRates={lossRates}
											onLossRatesChange={handleLossRatesChange}
											days={expenseDays}
											onDone={() => goToTab('overview')}
											primaryLabel="Update my profit"
										/>
									</motion.div>
								</TabsContent>
							</Tabs>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</MotionConfig>
	);
}

/** What was read out of the file, before any of it is interpreted — the old app led with this too. */
function FileSummary({
	fileLabel,
	orders,
	products,
	period,
}: {
	fileLabel: string;
	orders: number;
	products: number;
	period: string;
}) {
	const cells = [
		{ value: fileLabel, label: 'File', truncate: true },
		{ value: formatNumber(orders), label: 'Orders' },
		{ value: formatNumber(products), label: 'Products' },
		{ value: period, label: 'Period' },
	];

	/*
	 * One thin bar, not four cards.
	 *
	 * This is confirmation, not content — the seller reads it once to check they picked the right
	 * file, and never again. As four bordered cards with 40px icon tiles it took 150px of the
	 * screen on a phone and pushed the actual work below the fold.
	 */
	return (
		<motion.dl
			variants={STAGGER_LIST}
			initial="hidden"
			animate="show"
			className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3"
		>
			<FileSpreadsheetIcon className="size-4 shrink-0 self-center text-chart-2" aria-hidden="true" />
			{cells.map((cell) => (
				<motion.div key={cell.label} variants={STAGGER_ITEM} className="flex min-w-0 items-baseline gap-1.5">
					<dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{cell.label}</dt>
					<dd
						className={cn(
							'text-sm font-medium tabular-nums',
							cell.truncate && 'max-w-[14rem] truncate',
						)}
						title={cell.truncate ? cell.value : undefined}
					>
						{cell.value}
					</dd>
				</motion.div>
			))}
		</motion.dl>
	);
}

/** Placeholder cards while the recharts chunk downloads, sized so the page doesn't jump when it lands. */
/**
 * Placeholders shaped like the charts that replace them — same grid, same heights — so the swap
 * doesn't shunt the page. Three equal stacked blocks stood in for a two-column row plus a wide
 * one, which meant everything below jumped the moment recharts arrived.
 */
function ChartsFallback() {
	return (
		<div className="space-y-4" aria-live="polite" aria-busy="true">
			<p className="sr-only">Drawing your charts</p>
			<div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
				<div
					className="h-[30rem] animate-pulse rounded-2xl border border-border bg-card"
					aria-hidden="true"
				/>
				<div
					className="h-[30rem] animate-pulse rounded-2xl border border-border bg-card"
					style={{ animationDelay: '120ms' }}
					aria-hidden="true"
				/>
			</div>
			<div
				className="h-[27rem] animate-pulse rounded-2xl border border-border bg-card"
				style={{ animationDelay: '240ms' }}
				aria-hidden="true"
			/>
		</div>
	);
}
