import { PlusIcon, Undo2Icon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { cn } from 'cn';
import { DAYS_IN_MONTH, prorate, totalProrated, type ExpenseRow } from './expenses';
import { formatCurrency } from './format';
import { LossRatesPanel } from './LossRatesPanel';
import { outlineAction } from '@/components/tool/buttons';
import { Disclosure } from './ListCard';
import { AnimatedNumber, COLLAPSE, EASE_OUT, STAGGER_ITEM, STAGGER_LIST } from './motion';
import { DEFAULT_LOSS_RATES } from './preferences';
import { StatTile } from './StatTile';
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
	const monthlyTotal = rows.reduce((sum, row) => sum + row.monthly, 0);
	const changedRates = (Object.keys(DEFAULT_LOSS_RATES) as (keyof LossRates)[]).filter(
		(key) => lossRates[key] !== DEFAULT_LOSS_RATES[key],
	).length;

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
				<h2 className="text-xl font-bold tracking-tight sm:text-2xl">
					What does it cost you to run the business each month?
				</h2>
				<p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
					Rent, salaries, bills — enter once, reused for every file.
				</p>
			</motion.div>

			{/* The answer this screen exists to produce, as the cropper's result tiles — the monthly
			  * bill, and the share of it this payment file has to carry. */}
			<motion.div variants={STAGGER_ITEM} className="grid grid-cols-2 gap-2.5">
				<StatTile value={<AnimatedNumber value={monthlyTotal} format={formatCurrency} />} label="Per month" />
				<StatTile
					value={<AnimatedNumber value={total} format={formatCurrency} />}
					label={partialMonth ? `Charged to this file · ${days} of ${DAYS_IN_MONTH} days` : 'Charged to this file'}
					valueClassName={total > 0 ? 'text-destructive' : undefined}
				/>
			</motion.div>

			<motion.section variants={STAGGER_ITEM} className="overflow-hidden rounded-2xl border border-border bg-card">
				{/* Column headings, which is what turns four scattered inputs into a table. The two
				  * money columns are different questions — what you pay a month, and what that comes
				  * to over this file's window — and until they were named, the second was an
				  * unexplained number sitting between the input and a delete button. */}
				<header
					className={cn(
						'border-b border-border px-4 py-3',
						COLUMNS,
					)}
				>
					<h3 className="text-sm font-semibold tracking-tight">Expense</h3>
					<span className="hidden text-right text-xs font-medium text-muted-foreground sm:block">
						Per month
					</span>
					<span className="hidden text-right text-xs font-medium text-muted-foreground sm:block">
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
											'w-full rounded-xl border border-transparent bg-transparent px-2 py-1.5 font-medium',
											// 16px. Any smaller and iOS Safari zooms the whole page in when
											// the field takes focus, which on a four-field form means
											// pinching back out four times.
											'text-base outline-none sm:min-w-0 sm:flex-1',
											// It looks like plain text until you go near it, which is the
											// point — these four are named already — but it has to admit
											// that it's editable when you do.
											'transition-colors hover:border-border hover:bg-background',
											'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-primary/15',
										)}
									/>

									<div className="mt-2 flex items-center gap-3 sm:mt-0 sm:contents">
										{/* The border and the focus ring belong to the box, not the input,
										  * so the ₹ sits inside the field rather than beside it. */}
										<div
											className={cn(
												'flex h-12 flex-1 items-center rounded-xl border bg-background px-3 sm:h-10 sm:flex-none',
												'transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15',
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
													'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
												)}
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
												'flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-9',
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
						className={cn(outlineAction, 'text-primary')}
					>
						<PlusIcon className="size-4" aria-hidden="true" />
						Add expense
					</button>

					<p className="text-right text-xs text-muted-foreground tabular-nums">
						{rows.length} {rows.length === 1 ? 'expense' : 'expenses'} · saved on this device
					</p>
				</div>
			</motion.section>

			{/* Collapsed by default. These change cost of goods rather than adding to it, and the
			  * defaults are right for most sellers — but the one who resells every RTO item needs
			  * them, and their profit is badly wrong until they're set. */}
			<motion.div variants={STAGGER_ITEM}>
				<Disclosure
					id="loss-rates"
					icon={<Undo2Icon />}
					title="How much do returns really cost you?"
					hint="Optional · the defaults assume the worst"
					badge={changedRates > 0 ? `${changedRates} changed` : undefined}
					open={openRates}
					onOpenChange={setOpenRates}
				>
					<AnimatePresence initial={false}>
						{openRates && (
							<motion.div id="loss-rates" {...COLLAPSE} className="overflow-hidden">
								<div className="px-3 pb-3">
									<LossRatesPanel value={lossRates} onChange={onLossRatesChange} />
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</Disclosure>
			</motion.div>

			<StickyActions label={primaryLabel} onClick={onDone} secondary={secondary} />
		</motion.div>
	);
}
