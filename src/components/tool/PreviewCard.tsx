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
		<div className="flex flex-1 flex-col items-center gap-3">
			<p className="self-start text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview</p>
			{/* The outer div is the flexible area that centres the label as the card stretches to match the options
			 * column; the inner one hugs the canvas so the label reads as a framed sheet rather than a small render
			 * marooned in a full-width grey panel. */}
			<div className="flex w-full flex-1 items-center justify-center py-1">
				<div className="flex max-w-full min-h-52 min-w-52 items-center justify-center rounded-xl border border-border/60 bg-muted/30 p-3">
					<motion.canvas
						ref={canvasRef}
						initial={false}
						animate={{ opacity: status === 'ready' ? 1 : 0 }}
						transition={{ duration: 0.25 }}
						// `h-auto!` overrides the pixel height the renderer sets inline, so if the frame is ever narrower
						// than the render target (small phones) the label scales down by its own aspect ratio instead
						// of overflowing.
						className={status === 'ready' ? 'h-auto! max-w-full rounded-sm bg-white shadow-sm' : 'hidden'}
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
								className="max-w-44 text-center text-sm text-muted-foreground"
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
								className="flex max-w-44 flex-col items-center gap-2 text-center text-sm text-muted-foreground"
							>
								<ImageOffIcon className="size-5" />
								Couldn't generate a preview for this file, but processing may still work.
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
			<p className="text-center text-xs text-muted-foreground">Page 1 of your first file — this is how your output will look.</p>
		</div>
	);
}
