import { ImageOffIcon, Loader2Icon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { RefObject } from 'react';

export type PreviewStatus = 'empty' | 'loading' | 'ready' | 'unavailable';

interface PreviewCardProps {
	status: PreviewStatus;
	canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function PreviewCard({ status, canvasRef }: PreviewCardProps) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5">
			<p className="self-start text-sm font-semibold">Preview</p>
			<div className="flex min-h-56 w-full items-center justify-center rounded-lg bg-muted/40 p-3">
				<motion.canvas
					ref={canvasRef}
					initial={false}
					animate={{ opacity: status === 'ready' ? 1 : 0 }}
					transition={{ duration: 0.25 }}
					className={status === 'ready' ? 'rounded-sm shadow-sm' : 'hidden'}
					aria-label="Preview of the first cropped label"
				/>
				<AnimatePresence mode="wait">
					{status === 'empty' && (
						<motion.p
							key="empty"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="max-w-52 text-center text-sm text-muted-foreground"
						>
							Add a PDF to see how your first label will look.
						</motion.p>
					)}
					{status === 'loading' && (
						<motion.div
							key="loading"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="flex flex-col items-center gap-2 text-sm text-muted-foreground"
						>
							<Loader2Icon className="size-5 animate-spin" />
							Rendering preview…
						</motion.div>
					)}
					{status === 'unavailable' && (
						<motion.div
							key="unavailable"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="flex max-w-52 flex-col items-center gap-2 text-center text-sm text-muted-foreground"
						>
							<ImageOffIcon className="size-5" />
							Couldn't generate a preview for this file, but processing may still work.
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<p className="text-center text-xs text-muted-foreground">Page 1 of your first file — this is how your output will look.</p>
		</div>
	);
}
