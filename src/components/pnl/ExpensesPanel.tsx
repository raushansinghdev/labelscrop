import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { cn } from 'cn';
import { DAYS_IN_MONTH, prorate, totalProrated, type ExpenseRow } from './expenses';
import { formatCurrency } from './format';
import { LossRatesPanel } from './LossRatesPanel';
import { EASE_OUT, STAGGER_ITEM, STAGGER_LIST } from './motion';
import { StickyActions } from './StickyActions';
import type { LossRates } from './types';

interface ExpensesPanelProps {
	rows: ExpenseRow[];
	onChange: (next: ExpenseRow[]) => void;
	lossRates: LossRates;
	onLossRatesChange: (next: LossRates) => void;
	/** Days the payment file covers, so monthly amounts can be charged proportionally. */
	days: number;
	onDone: () => void;
	primaryLabel?: string;
	secondary?: { label: string; onClick: () => void };
}

let customSeq = 0;

/**
 * Step 3: what the business costs to run, whether or not anything sold.
 *
 * The seller asked for this because settlement minus cost of goods is not what lands in their
 * pocket — rent and salary come out too, and Meesho's own reporting has no idea they exist. It
 * shares this screen with the return write-off rates, which sit below in a collapsed section:
 * they matter, but they are a refinement of a number, while this is a whole missing column.
 */
export function ExpensesPanel({
	rows,
	onChange,
	lossRates,
	onLossRatesChange,
	days,
	onDone,
	primaryLabel = 'See my profit',
	secondary,
}: ExpensesPanelProps) {
	const [openRates, setOpenRates] = useState(false);
	const total = totalProrated(rows, days);
	const partialMonth = days !== DAYS_IN_MONTH;

	function setAmount(id: string, value: string) {
		const monthly = Number(value);
		onChange(
			rows.map((row) =>
				row.id === id ? { ...row, monthly: Number.isFinite(monthly) && monthly > 0 ? monthly : 0 } : row,
			),
		);
	}

	function setLabel(id: string, label: string) {
		onChange(rows.map((row) => (row.id === id ? { ...row, label } : row)));
	}

	function addRow() {
		onChange([...rows, { id: `custom-${++customSeq}-${Date.now()}`, label: '', monthly: 0 }]);
	}

	function removeRow(id: string) {
		onChange(rows.filter((row) => row.id !== id));
	}

	return (
		<motion.div variants={STAGGER_LIST} initial="hidden" animate="show" className="space-y-3">
			<motion.div variants={STAGGER_ITEM} className="rounded-xl border border-border bg-muted/30 p-3.5">
				<p className="text-sm font-medium">What does it cost you to run the business each month?</p>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					Rent, salaries and subscriptions are paid whether or not you sell anything, so Meesho's settlement
					never mentions them. Enter them once — they're saved on this device and reused for every future
					payment file.
				</p>
			</motion.div>

			<motion.section variants={STAGGER_ITEM} className="overflow-hidden rounded-xl border border-border bg-card">
				<header className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
					<h3 className="text-sm font-semibold tracking-tight">Monthly expenses</h3>
					<span className="text-[11px] text-muted-foreground">Per month</span>
				</header>

				<ul className="divide-y divide-border">
					<AnimatePresence initial={false}>
						{rows.map((row) => (
							<motion.li
								key={row.id}
								layout
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								transition={{ duration: 0.2, ease: EASE_OUT }}
								// Two lines on a phone: name across the top, amount and its prorated share
								// below. On one line, "Bills & subscriptions" had 84px to live in and read
								// as "Bills &". One line again from `sm`, where there is room for both.
								className="px-3.5 py-2 sm:flex sm:items-center sm:gap-2"
							>
								<input
									type="text"
									value={row.label}
									onChange={(e) => setLabel(row.id, e.target.value)}
									placeholder="What is it for?"
									aria-label="Expense name"
									className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none transition-colors hover:border-border focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring sm:min-w-0 sm:flex-1"
								/>

								<div className="mt-1.5 flex items-center gap-2 sm:mt-0 sm:contents">
								<div className="relative flex-1 sm:w-32 sm:flex-none">
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
										step="1"
										value={row.monthly === 0 ? '' : row.monthly}
										onChange={(e) => setAmount(row.id, e.target.value)}
										placeholder="0"
										aria-label={`${row.label || 'Expense'} per month`}
										className="h-11 w-full rounded-md border border-border bg-background pl-5 pr-2 text-right text-sm tabular-nums sm:h-9 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										style={{ MozAppearance: 'textfield' }}
									/>
								</div>

								{/* The share actually charged. Shown per row rather than only as a total,
								  * because "₹10,000 rent" turning into ₹9,667 is exactly the kind of
								  * quiet adjustment that makes a seller distrust the whole number. */}
								<span
									className={cn(
										'w-20 shrink-0 text-right text-xs tabular-nums sm:w-24',
										row.monthly > 0 ? 'text-muted-foreground' : 'text-transparent',
									)}
								>
									{formatCurrency(prorate(row.monthly, days))}
								</span>

								<button
									type="button"
									onClick={() => removeRow(row.id)}
									aria-label={`Remove ${row.label || 'this expense'}`}
									className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-7"
								>
									<XIcon className="size-3.5" aria-hidden="true" />
								</button>
								</div>
							</motion.li>
						))}
					</AnimatePresence>
				</ul>

				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3.5 py-2.5">
					<button
						type="button"
						onClick={addRow}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium sm:h-8 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						<PlusIcon className="size-3.5" aria-hidden="true" />
						Add expense
					</button>

					<p className="text-xs text-muted-foreground">
						<span className="font-semibold text-foreground tabular-nums">{formatCurrency(total)}</span>{' '}
						charged to this file
						{partialMonth && (
							<span className="tabular-nums">
								{' '}
								· {days} of {DAYS_IN_MONTH} days
							</span>
						)}
					</p>
				</div>
			</motion.section>

			{/* Collapsed by default. These change cost of goods rather than adding to it, and the
			  * defaults are right for most sellers — but the one who resells every RTO item needs
			  * them, and their profit is badly wrong until they're set. */}
			<motion.section variants={STAGGER_ITEM} className="rounded-xl border border-border bg-card">
				<button
					type="button"
					onClick={() => setOpenRates((open) => !open)}
					aria-expanded={openRates}
					className="flex w-full items-center justify-between gap-3 p-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<span className="min-w-0">
						<span className="block text-sm font-semibold tracking-tight">
							How much do returns really cost you?
						</span>
						<span className="mt-0.5 block text-xs text-muted-foreground">
							Set how much of an item is written off when it comes back. Leave it alone if you're not
							sure — the defaults assume the worst.
						</span>
					</span>
					<ChevronDownIcon
						className={cn(
							'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
							openRates && 'rotate-180',
						)}
						aria-hidden="true"
					/>
				</button>

				<AnimatePresence initial={false}>
					{openRates && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: 'auto', opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.28, ease: EASE_OUT }}
							className="overflow-hidden"
						>
							<div className="border-t border-border p-3.5">
								<LossRatesPanel value={lossRates} onChange={onLossRatesChange} />
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.section>

			<StickyActions label={primaryLabel} onClick={onDone} secondary={secondary} />
		</motion.div>
	);
}
