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
			className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/15 sm:p-5"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h3 className="text-base font-semibold tracking-tight">{title}</h3>
				<div className="flex shrink-0 items-baseline gap-3">
					{badge && <span className="text-sm tabular-nums text-muted-foreground">{badge}</span>}
					{action}
				</div>
			</div>
			<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{caption}</p>
			<div className="mt-4 flex-1">{children}</div>
		</motion.section>
	);
}

/**
 * Shared tooltip shell. Recharts renders tooltips into the chart's own DOM, so these inherit the
 * page theme — unlike the original app, which hardcoded a dark panel that was invisible in light mode.
 */
export function ChartTooltip({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="pointer-events-none max-w-64 rounded-xl border border-border bg-popover px-3.5 py-2.5 text-sm shadow-lg">
			<p className="font-semibold text-popover-foreground">{label}</p>
			<div className="mt-1 space-y-0.5 leading-relaxed text-muted-foreground">{children}</div>
		</div>
	);
}
