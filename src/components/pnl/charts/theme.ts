/**
 * The chart chrome, in one place.
 *
 * Axis type size, grid weight, bar thickness and entrance timing were restated in each of the
 * three charts, and had drifted: 10px ticks here, dashed grids there, bars left uncapped so a
 * seven-step waterfall drew hundred-pixel slabs. A dashboard whose charts disagree about any of
 * that reads as three charts borrowed from three places.
 */

import { useReducedMotion } from 'motion/react';

/**
 * 12px, not 10.
 *
 * Axis labels are the smallest text on the page and were set two steps below the body — legible
 * on the laptop they were built on and not on the phone most sellers open this with. 12px is the
 * floor for anything a reader is expected to actually parse.
 */
export const AXIS_TICK = { className: 'fill-muted-foreground', fontSize: 12 } as const;

/**
 * Bars are capped rather than left to fill their slot.
 *
 * Recharts divides the plot width by the category count, so a waterfall of eight steps across a
 * wide card drew bars over 100px thick — a wall of colour where the *length* is the only thing
 * carrying meaning. Capped, the leftover band becomes air and the bridge reads as a chart again.
 */
export const MAX_BAR = 24;

/** Bars sit at their data end; the baseline end stays square, so bars grow *from* the axis. */
export const BAR_RADIUS = 4;

/** Solid hairlines. Dashed grids add ink that isn't data and read as content at a glance. */
export const GRID_CLASS = 'stroke-border';

/**
 * Recharts' own bar/pie grow animation, switched off for anyone who has asked for less motion.
 *
 * This is the one bit of chart motion that isn't decoration — bars growing from the baseline
 * shows which direction each step travels — but it is still motion, and `prefers-reduced-motion`
 * is a request, not a preference to weigh.
 */
export function useChartMotion(): { isAnimationActive: boolean; animationDuration: number } {
	const reduced = useReducedMotion();
	return { isAnimationActive: !reduced, animationDuration: reduced ? 0 : 650 };
}

/** "₹1.2L" / "₹45k" — full rupee counts are too wide for an axis, on any screen. */
export function compactInr(value: number): string {
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
	if (abs >= 1000) return `${sign}₹${Math.round(abs / 1000)}k`;
	return `${sign}₹${Math.round(abs)}`;
}
