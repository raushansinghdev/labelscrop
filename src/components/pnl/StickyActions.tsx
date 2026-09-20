import { ArrowRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { SPRING } from './motion';

interface StickyActionsProps {
	label: string;
	onClick: () => void;
	/** Swapped for a tick once the work is saved; defaults to the forward arrow. */
	icon?: LucideIcon;
	secondary?: { label: string; onClick: () => void };
}

/**
 * The way onward, pinned to the bottom of the screen on a phone.
 *
 * The cost step is 6,500px tall on a 390px screen with 39 SKUs in it. Left in the flow, "Save &
 * continue" sits at the far end of that, so a seller who fills in the five products they care
 * about has to scroll past the thirty-four they don't to get out. Sticky rather than fixed, so it
 * belongs to this panel and stops at its end instead of hovering over the page below it.
 *
 * It stays in the flow from `sm` up, where the whole panel is a screen or two and a floating bar
 * would be covering content for no reason.
 */
export function StickyActions({ label, onClick, icon: Icon = ArrowRightIcon, secondary }: StickyActionsProps) {
	return (
		<div
			className={cn(
				'sticky bottom-0 z-20 -mx-4 flex items-center gap-2 border-t border-border bg-background/90 px-4 py-2.5 backdrop-blur',
				// Clears the home indicator on an iPhone, and collapses to nothing everywhere else.
				'pb-[calc(0.625rem+env(safe-area-inset-bottom))]',
				'sm:static sm:mx-0 sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-2 sm:backdrop-blur-none',
			)}
		>
			{secondary ? (
				<button
					type="button"
					onClick={secondary.onClick}
					className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-10"
				>
					{secondary.label}
				</button>
			) : (
				<span className="hidden sm:block" />
			)}

			<motion.button
				type="button"
				onClick={onClick}
				whileTap={{ scale: 0.98 }}
				transition={SPRING}
				className={cn(
					// Full width of whatever the secondary button leaves on a phone; its natural
					// width on a laptop, where it sits at the right-hand end of the row.
					'group inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 sm:h-10 sm:flex-none',
					'text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20',
					'transition-colors hover:bg-primary/90',
					'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
				)}
			>
				{label}
				<Icon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
			</motion.button>
		</div>
	);
}
