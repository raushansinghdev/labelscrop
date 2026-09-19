import { ImageOffIcon, Loader2Icon, SparklesIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import type { PreviewStatus } from './PreviewCard';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface PreviewThumbProps {
	status: PreviewStatus;
	updating: boolean;
	/** Object URL of the latest rendered sheet, or null before the first render. */
	src: string | null;
	onOpen: () => void;
}

/** Phone-only live preview: a small sheet thumbnail that sits in the action bar, so the result of every option
 * tap stays in view while the options fill the screen. Tapping it opens the full-size {@link PreviewSheet}. */
export function PreviewThumb({ status, updating, src, onOpen }: PreviewThumbProps) {
	return (
		<motion.button
			type="button"
			onClick={onOpen}
			whileTap={{ scale: 0.94 }}
			disabled={status === 'unavailable'}
			aria-label="Open full preview"
			className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted p-1.5 lg:hidden"
		>
			{status === 'ready' && src ? (
				// Keyed on the URL so each fresh render pops in — a small cue that the tap above changed the output.
				<motion.img
					key={src}
					src={src}
					alt=""
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: updating ? 0.5 : 1, scale: 1 }}
					transition={{ duration: 0.35, ease: EASE_OUT }}
					className="h-full w-full rounded-[2px] bg-white object-contain shadow-sm"
				/>
			) : status === 'unavailable' ? (
				<ImageOffIcon className="size-5 text-muted-foreground" />
			) : (
				<span className="shimmer h-full w-3/4 rounded-[2px] bg-background" />
			)}
			{updating && status === 'ready' && (
				<span className="absolute inset-0 flex items-center justify-center">
					<Loader2Icon className="size-4 animate-spin text-primary" />
				</span>
			)}
		</motion.button>
	);
}

interface PreviewSheetProps {
	open: boolean;
	onClose: () => void;
	src: string | null;
	updating: boolean;
	summary: string[];
	onCreate: () => void;
	createDisabled: boolean;
}

/** Bottom sheet with the full first-sheet preview. Drag down, tap the backdrop, or press Escape to close. */
export function PreviewSheet({ open, onClose, src, updating, summary, onCreate, createDisabled }: PreviewSheetProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		// Lock the page behind the sheet so a swipe on the preview doesn't scroll the options underneath.
		const root = document.documentElement;
		const previousOverflow = root.style.overflow;
		root.style.overflow = 'hidden';
		window.addEventListener('keydown', onKey);
		return () => {
			root.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKey);
		};
	}, [open, onClose]);

	function handleDragEnd(_: unknown, info: PanInfo) {
		if (info.offset.y > 100 || info.velocity.y > 500) onClose();
	}

	if (typeof document === 'undefined') return null;

	return createPortal(
		<AnimatePresence>
			{open && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={onClose}
						className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
						aria-hidden="true"
					/>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-label="Preview of your first output page"
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ duration: 0.4, ease: EASE_OUT }}
						drag="y"
						dragConstraints={{ top: 0, bottom: 0 }}
						dragElastic={{ top: 0, bottom: 0.6 }}
						onDragEnd={handleDragEnd}
						className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col rounded-t-3xl bg-background px-4 pt-2 pb-safe shadow-2xl"
					>
						<div className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
						<div className="flex items-center justify-between pb-3">
							<div>
								<p className="font-semibold">Preview</p>
								<p className="text-xs text-muted-foreground">First sheet of your output</p>
							</div>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close preview"
								className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
							>
								<XIcon className="size-5" />
							</button>
						</div>

						<div className="relative flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-gradient-to-b from-muted/80 to-muted/40 p-4">
							{src && (
								<img
									src={src}
									alt="Preview of your first output page"
									draggable={false}
									className={cn(
										'max-h-[60svh] w-auto max-w-full rounded-[3px] bg-white object-contain shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)] transition-opacity',
										updating && 'opacity-55',
									)}
								/>
							)}
							{updating && (
								<span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm ring-1 ring-border">
									<Loader2Icon className="size-3 animate-spin" />
									Updating
								</span>
							)}
						</div>

						{summary.length > 0 && (
							<div className="flex flex-wrap justify-center gap-1.5 pt-3">
								{summary.map((item) => (
									<span key={item} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
										{item}
									</span>
								))}
							</div>
						)}

						<div className="flex gap-2.5 pt-4 pb-4">
							<button
								type="button"
								onClick={onClose}
								className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-14 flex-1 rounded-2xl text-base')}
							>
								Edit options
							</button>
							<button
								type="button"
								onClick={onCreate}
								disabled={createDisabled}
								className={cn(
									buttonVariants({ size: 'lg' }),
									'h-14 flex-[1.4] gap-2 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25',
								)}
							>
								<SparklesIcon className="size-5" />
								Create labels
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
