import { ImageOffIcon, Loader2Icon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { RefObject } from 'react';
import { cn } from 'cn';

export type PreviewStatus = 'empty' | 'loading' | 'ready' | 'unavailable';

interface PreviewCardProps {
	status: PreviewStatus;
	/** True while a re-render for changed options is in flight and the previous render is still on screen. */
	updating: boolean;
	canvasRef: RefObject<HTMLCanvasElement | null>;
	/** Short chips describing what the preview shows, e.g. ["A4", "4 per sheet", "Label only"]. */
	summary: string[];
}

export function PreviewCard({ status, updating, canvasRef, summary }: PreviewCardProps) {
	return (
		<div className="flex flex-col items-center gap-3">
			{/* A soft "desk" behind the sheet so the white page reads as paper in both light and dark themes. */}
			<div className="relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-muted/80 to-muted/40 p-4 sm:p-6">
				<motion.canvas
					ref={canvasRef}
					initial={false}
					animate={{
						opacity: status === 'ready' ? (updating ? 0.55 : 1) : 0,
						scale: status === 'ready' ? (updating ? 0.985 : 1) : 0.96,
						filter: updating ? 'blur(1px)' : 'blur(0px)',
					}}
					transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
					// Width/height stay `auto` so max-width/max-height clamp the canvas while keeping its aspect
					// ratio: on phones the sheet fits in roughly half the screen height, leaving the options in view.
					className={cn(
						'h-auto max-h-[46svh] w-auto max-w-full rounded-[3px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)] lg:max-h-[62vh]',
						status !== 'ready' && 'hidden',
					)}
					aria-label="Preview of your first output page"
				/>

				<AnimatePresence>
					{updating && status === 'ready' && (
						<motion.span
							initial={{ opacity: 0, y: -6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm ring-1 ring-border backdrop-blur"
						>
							<Loader2Icon className="size-3 animate-spin" />
							Updating
						</motion.span>
					)}
				</AnimatePresence>

				<AnimatePresence mode="wait">
					{(status === 'empty' || status === 'loading') && (
						<motion.div
							key="loading"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="flex flex-col items-center gap-3"
						>
							{/* Paper-shaped skeleton so the layout doesn't jump when the real sheet arrives. */}
							<div className="shimmer flex aspect-[3/4] w-40 flex-col gap-2 rounded-[3px] bg-background p-3 shadow-sm sm:w-48">
								<div className="h-2 w-2/3 rounded bg-muted" />
								<div className="h-2 w-1/2 rounded bg-muted" />
								<div className="mt-2 h-10 rounded bg-muted" />
								<div className="h-2 w-3/4 rounded bg-muted" />
								<div className="h-2 w-1/3 rounded bg-muted" />
							</div>
							<span className="text-xs font-medium text-muted-foreground">Building your preview…</span>
						</motion.div>
					)}
					{status === 'unavailable' && (
						<motion.div
							key="unavailable"
							initial={{ opacity: 0, scale: 0.96 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0 }}
							className="flex max-w-56 flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground"
						>
							<ImageOffIcon className="size-6" />
							Couldn't draw a preview for this file — processing may still work fine.
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{summary.length > 0 && (
				<div className="flex flex-wrap justify-center gap-1.5">
					<AnimatePresence initial={false} mode="popLayout">
						{summary.map((item) => (
							<motion.span
								key={item}
								layout
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.2 }}
								className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
							>
								{item}
							</motion.span>
						))}
					</AnimatePresence>
				</div>
			)}
		</div>
	);
}
