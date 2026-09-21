import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { STAGGER_ITEM } from '../motion';

interface ChartCardProps {
	title: string;
	/** One line explaining what the chart is for — these are not self-evident to a first-time seller. */
	caption: string;
	/** Shown at the top right, e.g. a total. */
	badge?: string;
	/** The one way out of this card — a link to wherever the full data behind it lives. */
	action?: ReactNode;
	children: ReactNode;
}

export function ChartCard({ title, caption, badge, action, children }: ChartCardProps) {
	return (
		<motion.section
			variants={STAGGER_ITEM}
			// The cropper's list-card frame: a header row that names the thing and says how big it
			// is, then the content. Same frame as the cost table, so every panel reads alike.
			className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
		>
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
				<h3 className="text-sm font-semibold">{title}</h3>
				<div className="flex shrink-0 items-center gap-3">
					{badge && <span className="text-xs tabular-nums text-muted-foreground">{badge}</span>}
					{action}
				</div>
			</div>
			<div className="flex flex-1 flex-col p-4">
				<p className="text-xs leading-relaxed text-muted-foreground">{caption}</p>
				<div className="mt-3 flex-1">{children}</div>
			</div>
		</motion.section>
	);
}

