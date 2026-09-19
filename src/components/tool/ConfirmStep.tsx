import { AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { PreviewCard, type PreviewStatus } from './PreviewCard';
import { ProcessProgress, type ProgressEvent } from './ProcessProgress';

interface ConfirmStepProps {
	fileCount: number;
	previewStatus: PreviewStatus;
	canvasRef: RefObject<HTMLCanvasElement | null>;
	processing: boolean;
	progressEvent: ProgressEvent | null;
	runError: string | null;
	onEdit: () => void;
	onConfirm: () => void;
}

/** Right-hand column of the configure stage: the live preview of the first label, with the button that
 * kicks off the actual (worker-driven) processing run below it. */
export function ConfirmStep({
	fileCount,
	previewStatus,
	canvasRef,
	processing,
	progressEvent,
	runError,
	onEdit,
	onConfirm,
}: ConfirmStepProps) {
	return (
		<div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
			<PreviewCard status={previewStatus} canvasRef={canvasRef} />

			<AnimatePresence mode="wait">
				{processing ? (
					<motion.div
						key="progress"
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.18 }}
					>
						<ProcessProgress event={progressEvent} />
					</motion.div>
				) : (
					<motion.div
						key="actions"
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.18 }}
						className="space-y-2.5"
					>
						{runError && (
							<p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
								<AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
								{runError}
							</p>
						)}
						{previewStatus === 'loading' && (
							<p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
								<Loader2Icon className="size-3.5 animate-spin" />
								Building your preview…
							</p>
						)}
						{/* Stacked on phones, where two equally-weighted full-width bars read as a wall: `flex-col-reverse`
						 * lifts the primary action to the top and "Change files" drops to a quiet ghost beneath it.
						 * From `sm` up there's room for the conventional side-by-side pair. */}
						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2.5">
							<Button
								type="button"
								size="lg"
								variant="outline"
								onClick={onEdit}
								className="max-sm:h-11 max-sm:border-transparent max-sm:bg-transparent sm:flex-1"
							>
								Change files
							</Button>
							<Button
								type="button"
								size="lg"
								onClick={onConfirm}
								disabled={previewStatus === 'loading'}
								className="max-sm:h-11 sm:flex-1"
							>
								{runError ? 'Try again' : `Proceed — ${fileCount} file${fileCount === 1 ? '' : 's'}`}
							</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
