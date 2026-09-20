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
 * The column track, shared by the header and every row.
 *
 * It has to be one definition used twice: the header's "Per month" used to be a lone span pushed
 * right by `justify-between`, which landed it over the *prorated* column rather than the inputs it
 * named — a heading sitting above the wrong numbers. Now the two cannot drift apart.
 */
const COLUMNS = 'sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_8.5rem_2.5rem] sm:items-center sm:gap-3';

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
		<motion.div variants={STAGGER_LIST} initial="hidden" animate="show" className="space-y-4">
			{/* The instruction, as one sentence a seller can act on. It was a three-line grey block
			  * set at 12px — the least important thing on the screen, given the most of it. */}
			<motion.div variants={STAGGER_ITEM} className="px-1">
				<h2 className="text-lg font-semibold tracking-tight">
					What does it cost you to run the business each month?
				</h2>
				<p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
					Rent, salaries and subscriptions are paid whether or not you sell anything, so Meesho's settlement
					never mentions them. Enter them once — they're saved on this device and reused for every future
					payment file.
				</p>
			</motion.div>

			<motion.section variants={STAGGER_ITEM} className="overflow-hidden rounded-xl border border-border bg-card">
				{/* Column headings, which is what turns four scattered inputs into a table. The two
				  * money columns are different questions — what you pay a month, and what that comes
				  * to over this file's window — and until they were named, the second was an
				  * unexplained number sitting between the input and a delete button. */}
				<header
					className={cn(
						'border-b border-border bg-muted/30 px-4 py-3',
						COLUMNS,
					)}
				>
					<h3 className="text-sm font-semibold tracking-tight">Expense</h3>
					<span className="hidden text-right text-sm font-medium text-muted-foreground sm:block">
						Per month
					</span>
					<span className="hidden text-right text-sm font-medium text-muted-foreground sm:block">
						Charged to this file
					</span>
					<span className="hidden sm:block" />
				</header>

				<ul className="divide-y divide-border">
					<AnimatePresence initial={false}>
						{rows.map((row) => {
							const charged = prorate(row.monthly, days);
							const isSet = row.monthly > 0;
							return (
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
									// The name and its amount sit at opposite ends of a wide row, so the
									// row lights up as a whole to carry the eye across the gap between them.
									className={cn('px-4 py-3 transition-colors hover:bg-muted/40', COLUMNS)}
								>
									<input
										type="text"
										value={row.label}
										onChange={(e) => setLabel(row.id, e.target.value)}
										placeholder="What is it for?"
										aria-label="Expense name"
										className={cn(
											'w-full rounded-md border border-transparent bg-transparent px-2 py-1.5',
											// 16px. Any smaller and iOS Safari zooms the whole page in when
											// the field takes focus, which on a four-field form means
											// pinching back out four times.
											'text-base outline-none sm:min-w-0 sm:flex-1',
											// It looks like plain text until you go near it, which is the
											// point — these four are named already — but it has to admit
											// that it's editable when you do.
											'transition-colors hover:border-border hover:bg-background',
											'focus-visible:border-border focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring',
										)}
									/>

									<div className="mt-2 flex items-center gap-3 sm:mt-0 sm:contents">
										{/* The border and the focus ring belong to the box, not the input,
										  * so the ₹ sits inside the field rather than beside it. */}
										<div
											className={cn(
												'flex h-12 flex-1 items-center rounded-md border bg-background px-3 sm:h-10 sm:flex-none',
												'transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
												isSet ? 'border-border' : 'border-border/70',
											)}
										>
											<span className="text-base text-muted-foreground" aria-hidden="true">
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
												className={cn(
													'w-full min-w-0 bg-transparent pl-1.5 text-right text-base font-medium tabular-nums outline-none',
													'[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
												)}
												style={{ MozAppearance: 'textfield' }}
											/>
										</div>

										{/* The share actually charged. Shown per row rather than only as a
										  * total, because "₹10,000 rent" turning into ₹9,667 is exactly the
										  * kind of quiet adjustment that makes a seller distrust the whole
										  * number. On a phone it carries its own label, because there is no
										  * column heading up there to explain it. */}
										<span
											className={cn(
												'shrink-0 text-right text-base tabular-nums sm:w-full',
												isSet ? 'text-foreground' : 'text-muted-foreground/50',
											)}
										>
											{/* The column heading explains this figure from `sm` up. Below
											  * that there are no headings, so it carries a bare "=" — enough
											  * to read ₹3,500 a month as the ₹3,383 actually charged, rather
											  * than as a second unexplained amount. */}
											<span className="sr-only">Charged to this file: </span>
											{isSet && (
												<span className="text-muted-foreground sm:hidden" aria-hidden="true">
													={' '}
												</span>
											)}
											{isSet ? formatCurrency(charged) : '—'}
										</span>

										<button
											type="button"
											onClick={() => removeRow(row.id)}
											aria-label={`Remove ${row.label || 'this expense'}`}
											className={cn(
												'flex size-11 shrink-0 items-center justify-center rounded-md sm:size-8',
												'text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive',
												'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
											)}
										>
											<XIcon className="size-4" aria-hidden="true" />
										</button>
									</div>
								</motion.li>
							);
						})}
					</AnimatePresence>
				</ul>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
					<button
						type="button"
						onClick={addRow}
						className={cn(
							'inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3.5 text-sm font-medium',
							'transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
						)}
					>
						<PlusIcon className="size-4" aria-hidden="true" />
						Add expense
					</button>

					{/* The answer this screen exists to produce, so it is the largest thing in the
					  * card rather than 12px of grey beside a button. */}
					<p className="text-right text-sm text-muted-foreground">
						<span className="text-lg font-semibold tabular-nums text-foreground">
							{formatCurrency(total)}
						</span>{' '}
						charged to this file
						{partialMonth && (
							<span className="block tabular-nums">
								{days} of {DAYS_IN_MONTH} days
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
					className="flex w-full items-center justify-between gap-4 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<span className="min-w-0">
						<span className="block text-base font-semibold tracking-tight">
							How much do returns really cost you?
						</span>
						<span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
							Set how much of an item is written off when it comes back. Leave it alone if you're not
							sure — the defaults assume the worst.
						</span>
					</span>
					<ChevronDownIcon
						className={cn(
							'size-5 shrink-0 text-muted-foreground transition-transform duration-200',
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
							<div className="border-t border-border p-4">
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
