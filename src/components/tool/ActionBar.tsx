import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Bottom-anchored action area. `position: sticky` (not `fixed`) keeps it pinned above the thumb while the
 * tool is on screen, then lets it settle into place at the end of the tool instead of covering the page
 * content below — so the primary action is always one tap away on a phone without a long scroll. */
export function ActionBar({ children }: { children: ReactNode }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 24 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 24 }}
			transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
			className="sticky bottom-0 z-30 -mx-4 mt-6 px-4 pt-6 pb-safe sm:mx-0 sm:px-0"
		>
			<div
				className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background from-60% to-transparent"
				aria-hidden="true"
			/>
			<div className="relative">{children}</div>
		</motion.div>
	);
}
