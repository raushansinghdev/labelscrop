'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ReactNode } from 'react';
import { cn } from 'cn';

/** One term-and-figure line inside a metric's hover panel. */
export interface MetricRow {
	term: string;
	value: string;
	/** Colours the figure only where it is unambiguously good or bad news. */
	tone?: 'good' | 'bad';
	/** Dropped when false, so call sites can list conditional lines inline. */
	when?: boolean;
}

interface MetricTooltipProps {
	/** The metric's own name, repeated at the top of the panel. */
	title: string;
	/** What the figure actually counts, in the seller's own words. */
	meaning: string;
	/** The numbers behind it — the working, not the headline. */
	rows: MetricRow[];
	/** The caveat that stops the figure being misread. */
	footnote?: string;
	side?: 'top' | 'bottom' | 'left' | 'right';
	/** Classes for the trigger, which is the tile or card being explained. */
	className?: string;
	children: ReactNode;
}

/**
 * The explanation behind a figure, on hover.
 *
 * Every number on this screen is a summary of an arithmetic a seller did not watch happen, and the
 * one-line hint under a tile has never been enough room to show the working. So each figure carries
 * a panel: what it counts, the parts it is made of, and the caveat that keeps it from being
 * misread. Nothing here navigates — hovering explains, and the one place that goes somewhere says
 * so in words.
 *
 * The trigger is a real `<button>`, which is what makes this reachable by keyboard and by tap: a
 * touch user has no hover, but focus opens the panel just the same.
 */
export function MetricTooltip({
	title,
	meaning,
	rows,
	footnote,
	side = 'top',
	className,
	children,
}: MetricTooltipProps) {
	const shown = rows.filter((row) => row.when !== false);

	return (
		<TooltipPrimitive.Root>
			<TooltipPrimitive.Trigger
				type="button"
				className={cn(
					'cursor-help text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
					className,
				)}
			>
				{children}
			</TooltipPrimitive.Trigger>

			<TooltipPrimitive.Portal>
				<TooltipPrimitive.Positioner
					side={side}
					sideOffset={8}
					collisionPadding={16}
					className="z-50"
				>
					<TooltipPrimitive.Popup
						className={cn(
							'w-[min(20rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-xl border border-border',
							'bg-popover p-4 text-left shadow-xl',
							'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
							'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
						)}
					>
						<p className="text-sm font-semibold text-popover-foreground">{title}</p>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{meaning}</p>

						{shown.length > 0 && (
							<dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
								{shown.map((row) => (
									<div key={row.term} className="flex items-baseline justify-between gap-4">
										<dt className="min-w-0 text-muted-foreground">{row.term}</dt>
										<dd
											className={cn(
												'shrink-0 font-medium tabular-nums',
												row.tone === 'good' && 'text-success',
												row.tone === 'bad' && 'text-destructive',
												!row.tone && 'text-popover-foreground',
											)}
										>
											{row.value}
										</dd>
									</div>
								))}
							</dl>
						)}

						{footnote && (
							<p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
								{footnote}
							</p>
						)}
					</TooltipPrimitive.Popup>
				</TooltipPrimitive.Positioner>
			</TooltipPrimitive.Portal>
		</TooltipPrimitive.Root>
	);
}

/**
 * Shared open/close timing. Once one panel has opened, the next opens instantly, so reading along a
 * row of tiles doesn't mean waiting out the delay five times.
 */
export function MetricTooltipProvider({ children }: { children: ReactNode }) {
	return (
		<TooltipPrimitive.Provider delay={200} closeDelay={80}>
			{children}
		</TooltipPrimitive.Provider>
	);
}
