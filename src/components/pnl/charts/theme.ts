/**
 * The chart chrome and motion, in one place.
 *
 * The charts are drawn by hand in HTML and SVG with motion rather than by a chart library. Every
 * one of them is either a set of horizontal bars or one ring, which is little enough geometry to
 * own outright, and owning it is what lets them behave like the rest of the tool: they draw when
 * they scroll into view instead of once, off-screen, on load; bars arrive one after another in
 * the order they are read; and when a seller changes a cost the bars glide to their new size
 * instead of snapping or replaying from zero.
 */

import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type RefObject } from 'react';

/** Bars sit this tall inside a row; the rest of the row is air. */
export const BAR_HEIGHT = 24;

/**
 * Draws a chart once it is actually on screen.
 *
 * `settled` flips a beat after the entrance so later changes animate without the entrance's
 * stagger — a cost edit should move every bar at once, not replay the cascade.
 *
 * Reduced motion skips all of it: the chart is simply there, fully drawn.
 */
export function useChartReveal<T extends Element>(): {
	ref: RefObject<T | null>;
	revealed: boolean;
	settled: boolean;
	reduced: boolean;
} {
	const ref = useRef<T>(null);
	const reduced = Boolean(useReducedMotion());
	const inView = useInView(ref, { once: true, amount: 0.3 });
	const revealed = inView || reduced;
	const [settled, setSettled] = useState(false);

	useEffect(() => {
		if (!revealed || settled) return;
		const timer = window.setTimeout(() => setSettled(true), reduced ? 0 : 1600);
		return () => window.clearTimeout(timer);
	}, [revealed, settled, reduced]);

	return { ref, revealed, settled, reduced };
}

/** A spring for bar geometry: quick off the axis, a slight settle at the end. */
export function barTransition(index: number, settled: boolean, reduced: boolean) {
	if (reduced) return { duration: 0 };
	return { type: 'spring' as const, stiffness: 140, damping: 22, mass: 0.9, delay: settled ? 0 : 0.15 + index * 0.08 };
}

/** The pixel width of an element, kept current — label placement needs real space, not percentages. */
export function useElementWidth(ref: RefObject<Element | null>): number {
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const node = ref.current;
		if (!node || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(node);
		return () => observer.disconnect();
	}, [ref]);
	return width;
}

/** "₹1.2L" / "₹45k" — full rupee counts are too wide for an axis, on any screen. */
export function compactInr(value: number): string {
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
	if (abs >= 1000) return `${sign}₹${Math.round(abs / 1000)}k`;
	return `${sign}₹${Math.round(abs)}`;
}

/** Signed with a real minus rather than a hyphen — at 12px a hyphen beside ₹ disappears. */
export function signedInr(value: number): string {
	const rounded = Math.abs(value) < 0.5 ? 0 : value;
	return `${rounded < 0 ? '−' : '+'}${compactInr(Math.abs(rounded))}`;
}
