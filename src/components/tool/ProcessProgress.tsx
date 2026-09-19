import { AnimatePresence, motion } from 'motion/react';

export interface ProgressEvent {
	stage: 'reading' | 'composing' | 'summarizing';
	current: number;
	total: number;
}

const STAGE_LABEL: Record<ProgressEvent['stage'], string> = {
	reading: 'Reading your files…',
	composing: 'Cropping and arranging labels…',
	summarizing: 'Building the SKU summary…',
};

const STAGE_WEIGHT: Record<ProgressEvent['stage'], number> = { reading: 0, composing: 1, summarizing: 2 };

/** Compact progress readout sized to sit inside the sticky action bar, where the primary button was. */
export function ProcessProgress({ event }: { event: ProgressEvent | null }) {
	const stage = event?.stage ?? 'reading';
	const stageFraction = event && event.total > 0 ? event.current / event.total : 0;
	// Never report 0% — a bar that's visibly moving from the first frame reads as "working", not "stuck".
	const overall = Math.max(4, ((STAGE_WEIGHT[stage] + stageFraction) / 3) * 100);

	return (
		<div
			className="flex h-14 flex-col justify-center gap-2 rounded-2xl bg-card px-4 ring-1 ring-border"
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(overall)}
			aria-label={STAGE_LABEL[stage]}
		>
			<div className="flex items-center justify-between text-sm">
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={stage}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.18 }}
						className="font-medium"
					>
						{STAGE_LABEL[stage]}
					</motion.span>
				</AnimatePresence>
				<span className="font-semibold tabular-nums text-primary">{Math.round(overall)}%</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-muted">
				<motion.div
					className="shimmer h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
					initial={false}
					animate={{ width: `${overall}%` }}
					transition={{ type: 'spring', stiffness: 60, damping: 18 }}
				/>
			</div>
		</div>
	);
}
