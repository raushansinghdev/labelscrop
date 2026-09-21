import { ChevronDownIcon, PackageXIcon, RotateCcwIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from 'cn';
import { SPRING, STAGGER_ITEM, STAGGER_LIST } from './motion';
import type { LossRates } from './types';

interface LossRatesPanelProps {
	value: LossRates;
	onChange: (next: LossRates) => void;
}

interface Field {
	key: keyof LossRates;
	label: string;
	hint: string;
}

/**
 * Split into two groups because they answer two different questions. The first is "how much of the
 * *item* is gone", the second "how much of the *packaging* is gone" — and the honest answers differ
 * sharply: a returned item is often resellable, a torn courier bag never is.
 */
const GROUPS: { title: string; caption: string; icon: typeof RotateCcwIcon; fields: Field[] }[] = [
	{
		title: 'Stock you lose',
		caption: 'How much of the item itself is written off when an order does not stay delivered.',
		icon: RotateCcwIcon,
		fields: [
			{
				key: 'rto',
				label: 'Courier return',
				hint: "Meesho calls this RTO. It came back unopened, so if it's resellable your real loss is 0%.",
			},
			{
				key: 'return_rate',
				label: 'Customer return',
				hint: 'Often used or damaged, so the default assumes a total loss.',
			},
			{
				key: 'lost',
				label: 'Lost in transit',
				hint: 'Never reached anyone. The stock is gone.',
			},
			{
				key: 'unresolved',
				label: 'Unresolved',
				hint: "Status still blank in Meesho's export. Assume no loss until it settles.",
			},
		],
	},
	{
		title: 'Packaging you lose',
		caption: 'Material is spent the moment you ship, whether or not the item comes back.',
		icon: PackageXIcon,
		fields: [
			{
				key: 'rto_packaging_loss',
				label: 'Packaging on courier returns',
				hint: 'You cannot reuse a torn courier bag.',
			},
			{
				key: 'return_packaging_loss',
				label: 'Packaging on returns',
				hint: 'Same idea for customer returns.',
			},
		],
	},
];

/**
 * 0% is money kept, 100% is money gone — the readout is coloured so the row reads before it's read.
 *
 * The middle band wears `--warning` rather than `--chart-4`. They are both amber and they are not
 * interchangeable: a chart colour is tuned to stand off the card as a *mark* at 3:1, which as
 * 14px text on its own tint measured 2.86:1. The colour never carries the meaning alone anyway —
 * the chip spells out "70% lost" beside it.
 */
function severityClass(pct: number): string {
	if (pct === 0) return 'bg-success/15 text-success';
	if (pct >= 75) return 'bg-destructive/15 text-destructive';
	return 'bg-warning/15 text-warning';
}

export function LossRatesPanel({ value, onChange }: LossRatesPanelProps) {
	return (
		<motion.div variants={STAGGER_LIST} initial="hidden" animate="show" className="space-y-3">
			{GROUPS.map((group) => (
				<motion.section key={group.title} variants={STAGGER_ITEM} className="space-y-3">
					<div className="flex items-start gap-2 px-1">
						<group.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						<div>
							<h3 className="text-sm font-semibold tracking-tight">{group.title}</h3>
							<p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{group.caption}</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						{group.fields.map((field) => {
							const pct = Math.round(value[field.key] * 100);
							return (
								<div
									key={field.key}
									className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
								>
									<div className="flex items-center justify-between gap-3">
										<label htmlFor={`loss-${field.key}`} className="text-sm font-semibold">
											{field.label}
										</label>
										{/* Keyed on the value so the chip re-springs on every step —
										  * the number feels dragged rather than merely updated. */}
										<motion.span
											key={pct}
											initial={{ scale: 0.86 }}
											animate={{ scale: 1 }}
											transition={SPRING}
											className={cn(
												'shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums',
												severityClass(pct),
											)}
										>
											{pct}% lost
										</motion.span>
									</div>
									<input
										id={`loss-${field.key}`}
										type="range"
										min="0"
										max="100"
										step="5"
										value={pct}
										// The percentage is in the chip beside it, but a screen reader
										// reading "45" alone has no unit to hang it on.
										aria-valuetext={`${pct} percent lost`}
										onChange={(e) =>
											onChange({ ...value, [field.key]: Number(e.target.value) / 100 })
										}
										className="mt-3 h-7 w-full cursor-pointer accent-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
									/>
									<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{field.hint}</p>
								</div>
							);
						})}
					</div>
				</motion.section>
			))}

			{/* Collapsed by default: it's the most important caveat on the page but also the longest
			  * text on it, and leaving it open buried the sliders it's meant to qualify. */}
			<motion.details
				variants={STAGGER_ITEM}
				className="group rounded-2xl border border-border bg-card [&_summary::-webkit-details-marker]:hidden"
			>
				<summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
					How much of this is actually measured?
					<ChevronDownIcon
						className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
						aria-hidden="true"
					/>
				</summary>
				<div className="space-y-2.5 px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
					<p>
						Your settlement and ads figures come straight from Meesho's payment file — those are exact, and
						reconcile against your bank statement to the paisa.
					</p>
					<p>
						These loss rates are not measured. They are your judgement about how much stock you really lose
						when an order comes back, and nothing tracks that today. Cost of goods and therefore net profit
						rest on them, so treat the profit figure as only as good as your assumptions — not as a
						bank-verified number.
					</p>
				</div>
			</motion.details>

		</motion.div>
	);
}
