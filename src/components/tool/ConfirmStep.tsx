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

/** The step shown after the user clicks "Preview" on the configure screen: a full-size render of how the
 * first label will look, gating the actual (worker-driven) processing run behind an explicit confirmation —
 * per the plan's two-step "configure → confirm → process" flow, chosen over inline editing next to a live
 * preview so a first-time visitor always sees what they're about to get before it happens. */
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
		<div className="mx-auto max-w-md space-y-5">
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
						<div className="flex flex-col gap-2.5 sm:flex-row">
							<Button type="button" size="lg" variant="outline" onClick={onEdit} className="flex-1">
								Edit options
							</Button>
							<Button type="button" size="lg" onClick={onConfirm} disabled={previewStatus === 'loading'} className="flex-1">
								{runError ? 'Try again' : `Looks good — Process ${fileCount} file${fileCount === 1 ? '' : 's'}`}
							</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
