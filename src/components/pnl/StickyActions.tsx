import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ActionBar } from '@/components/tool/ActionBar';
import { backButton, primaryCta } from '@/components/tool/buttons';
import { TAP, TAP_ICON } from './motion';

interface StickyActionsProps {
	label: ReactNode;
	onClick: () => void;
	/** Swapped for a tick once the work is saved; defaults to the forward arrow. */
	icon?: LucideIcon;
	/** Quieter text after the label, e.g. "· 1 file, 240 KB". */
	detail?: ReactNode;
	/** The square way back. Its label is read out, since the button itself shows only an arrow. */
	secondary?: { label: string; onClick: () => void };
	/** Replaces the buttons while work is running — the cropper shows its progress in the same place. */
	busy?: ReactNode;
	disabled?: boolean;
}

/**
 * The way onward, exactly as the label cropper does it: a square back button and one tall primary
 * button, pinned to the bottom of the screen over a fade rather than a hard-edged bar.
 *
 * Sticky rather than fixed, so it belongs to this panel and settles at its end instead of hovering
 * over the page below. The cost step is 6,500px tall on a phone with 39 SKUs in it — without this a
 * seller who fills in the five they care about scrolls past the thirty-four they don't to get out.
 */
export function StickyActions({
	label,
	onClick,
	icon: Icon = ArrowRightIcon,
	detail,
	secondary,
	busy,
	disabled,
}: StickyActionsProps) {
	return (
		<ActionBar>
			<div className="mx-auto max-w-xl">
				<AnimatePresence mode="wait" initial={false}>
					{busy ? (
						<motion.div
							key="busy"
							initial={{ opacity: 0, scale: 0.97 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.97 }}
							transition={{ duration: 0.2 }}
						>
							{busy}
						</motion.div>
					) : (
						<motion.div
							key="actions"
							initial={{ opacity: 0, scale: 0.97 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.97 }}
							transition={{ duration: 0.2 }}
							className="flex gap-2.5"
						>
							{secondary && (
								<motion.button
									type="button"
									onClick={secondary.onClick}
									whileTap={TAP_ICON}
									aria-label={secondary.label}
									title={secondary.label}
									className={backButton}
								>
									<ArrowLeftIcon className="size-5" aria-hidden="true" />
								</motion.button>
							)}
							<motion.button type="button" onClick={onClick} disabled={disabled} whileTap={TAP} className={primaryCta}>
								{label}
								{detail && <span className="font-normal opacity-80">{detail}</span>}
								<Icon className="size-5" aria-hidden="true" />
							</motion.button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</ActionBar>
	);
}

/**
 * Indeterminate progress card for the action bar while files are read. Same frame as the cropper's
 * `ProcessProgress`, but there is no honest percentage to show here — SheetJS reports none.
 */
export function WorkingCard({ label }: { label: string }) {
	return (
		<div
			className="flex h-14 flex-col justify-center gap-2 rounded-2xl bg-card px-4 ring-1 ring-border"
			role="status"
			aria-live="polite"
		>
			<span className="text-sm font-medium">{label}</span>
			<div className="h-1.5 overflow-hidden rounded-full bg-muted">
				<motion.div
					className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary/60 to-primary"
					animate={{ x: ['-100%', '300%'] }}
					transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
				/>
			</div>
		</div>
	);
}
