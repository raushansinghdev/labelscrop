import { AnimatePresence, motion } from 'motion/react';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';

export interface ProgressEvent {
	stage: 'reading' | 'composing' | 'summarizing';
	current: number;
	total: number;
}

const STAGE_LABEL: Record<ProgressEvent['stage'], string> = {
	reading: 'Reading your files…',
	composing: 'Cropping and repacking labels…',
	summarizing: 'Building the SKU summary…',
};

const STAGE_WEIGHT: Record<ProgressEvent['stage'], number> = { reading: 0, composing: 1, summarizing: 2 };

export function ProcessProgress({ event }: { event: ProgressEvent | null }) {
	if (!event) return null;
	const stageFraction = event.total > 0 ? event.current / event.total : 0;
	const overall = ((STAGE_WEIGHT[event.stage] + stageFraction) / 3) * 100;

	return (
		<div className="rounded-2xl border border-border bg-card p-5">
			<Progress value={overall}>
				<div className="mb-2 flex items-center justify-between text-sm">
					<AnimatePresence mode="wait">
						<motion.span
							key={event.stage}
							initial={{ opacity: 0, y: -4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 4 }}
							transition={{ duration: 0.15 }}
							className="font-medium"
						>
							{STAGE_LABEL[event.stage]}
						</motion.span>
					</AnimatePresence>
					<span className="tabular-nums text-muted-foreground">{Math.round(overall)}%</span>
				</div>
				<ProgressTrack>
					<ProgressIndicator />
				</ProgressTrack>
			</Progress>
		</div>
	);
}
