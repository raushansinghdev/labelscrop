import { PackageOpenIcon, PackageXIcon, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from 'cn';
import { InfoTip } from './InfoTip';
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
const GROUPS: {
	title: string;
	caption: string;
	icon: LucideIcon;
	tone: keyof typeof TONES;
	fields: Field[];
}[] = [
	{
		title: 'Stock you lose',
		caption: 'How much of the item itself is written off when an order comes back or goes missing.',
		icon: PackageOpenIcon,
		tone: 'stock',
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
		caption: 'The bag, box and tape are spent the moment you ship, whether or not the item comes back.',
		icon: PackageXIcon,
		tone: 'packaging',
		fields: [
			{
				key: 'rto_packaging_loss',
				label: 'On courier returns',
				hint: 'You cannot reuse a torn courier bag.',
			},
			{
				key: 'return_packaging_loss',
				label: 'On customer returns',
				hint: 'A customer return comes back in torn or reused packaging too.',
			},
		],
	},
];

/**
 * Each group wears its own colour, all the way down to the slider fill, so "stock" and "packaging"
 * read as two separate questions at a glance rather than six sliders in one grid.
 */
const TONES = {
	stock: {
		panel: 'border-primary/20 bg-primary/[0.04]',
		badge: 'bg-primary/12 text-primary',
		slider: 'accent-[var(--primary)]',
	},
	packaging: {
		panel: 'border-chart-4/30 bg-chart-4/[0.07]',
		badge: 'bg-chart-4/20 text-warning',
		slider: 'accent-[var(--chart-4)]',
	},
} as const;

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
				<motion.section
					key={group.title}
					variants={STAGGER_ITEM}
					aria-labelledby={`loss-group-${group.tone}`}
					className={cn('rounded-2xl border p-3 sm:p-4', TONES[group.tone].panel)}
				>
					<div className="flex items-center gap-2.5">
						<span
							className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', TONES[group.tone].badge)}
							aria-hidden="true"
						>
							<group.icon className="size-4" />
						</span>
						<h3 id={`loss-group-${group.tone}`} className="text-sm font-semibold tracking-tight">
							{group.title}
						</h3>
						<InfoTip label={`About ${group.title.toLowerCase()}`}>{group.caption}</InfoTip>
					</div>

					<div className="mt-3 grid gap-2 sm:grid-cols-2">
						{group.fields.map((field) => {
							const pct = Math.round(value[field.key] * 100);
							return (
								<div key={field.key} className="rounded-xl border border-border bg-card px-3 pt-2.5 pb-1.5">
									<div className="flex items-center gap-2">
										<label htmlFor={`loss-${field.key}`} className="min-w-0 truncate text-sm font-medium">
											{field.label}
										</label>
										<InfoTip label={`About ${field.label.toLowerCase()}`}>{field.hint}</InfoTip>
										{/* Keyed on the value so the chip re-springs on every step —
										  * the number feels dragged rather than merely updated. */}
										<motion.span
											key={pct}
											initial={{ scale: 0.86 }}
											animate={{ scale: 1 }}
											transition={SPRING}
											className={cn(
												'ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
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
										className={cn(
											'mt-1 h-8 w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
											TONES[group.tone].slider,
										)}
									/>
								</div>
							);
						})}
					</div>
				</motion.section>
			))}

			{/* The caveat, one tap away. It used to be a paragraph-long disclosure of its own — the
			  * longest text on the screen, for the thing a seller least needs to read. */}
			<motion.div variants={STAGGER_ITEM} className="flex justify-center pt-1">
				<InfoTip label="How exact are these?" text="These are your estimates" side="top">
					Settlement and ads come straight from Meesho's file, so they're exact. These rates aren't
					measured anywhere — they're your best guess, and profit is only as right as they are.
				</InfoTip>
			</motion.div>
		</motion.div>
	);
}
