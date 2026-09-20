import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { STAGGER_ITEM } from '../motion';

interface ChartCardProps {
	title: string;
	/** One line explaining what the chart is for — these are not self-evident to a first-time seller. */
	caption: string;
	/** Shown at the top right, e.g. a total. */
	badge?: string;
	children: ReactNode;
}

export function ChartCard({ title, caption, badge, children }: ChartCardProps) {
	return (
		<motion.section
			variants={STAGGER_ITEM}
			className="rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/15 sm:p-4"
		>
			<div className="flex items-baseline justify-between gap-3">
				<h3 className="text-sm font-semibold tracking-tight">{title}</h3>
				{badge && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{badge}</span>}
			</div>
			<p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{caption}</p>
			<div className="mt-3">{children}</div>
		</motion.section>
	);
}

/**
 * Shared tooltip shell. Recharts renders tooltips into the chart's own DOM, so these inherit the
 * page theme — unlike the original app, which hardcoded a dark panel that was invisible in light mode.
 */
export function ChartTooltip({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="pointer-events-none max-w-56 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
			<p className="font-medium text-popover-foreground">{label}</p>
			<div className="mt-1 space-y-0.5 text-muted-foreground">{children}</div>
		</div>
	);
}
