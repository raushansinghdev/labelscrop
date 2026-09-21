/**
 * Motion vocabulary shared by every part of the profit calculator.
 *
 * These live in one place so the dashboard, the cost editor and the charts all ease, stagger and
 * settle identically — a tool that animates three different ways reads as three different tools.
 */

import { animate, motion, useMotionValue, useReducedMotion, type Variants } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** The house curve: fast out of the gate, long settle. Used for anything entering the screen. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** For things leaving — deliberately quicker, so exits never hold up the next thing arriving. */
export const EASE_IN = 'easeIn' as const;

/**
 * Springs rather than durations for anything that tracks a value or a position (the tab pill, a
 * progress bar, a slider fill). A duration makes those feel scripted; a spring makes them feel
 * attached to the thing that moved.
 */
export const SPRING = { type: 'spring' as const, stiffness: 400, damping: 34, mass: 0.8 };
export const SOFT_SPRING = { type: 'spring' as const, stiffness: 180, damping: 26 };

/** Cards and list rows fall in one after another rather than all at once. */
export const STAGGER_LIST: Variants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const STAGGER_ITEM: Variants = {
	hidden: { opacity: 0, y: 14 },
	show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } },
};

/** Whole-stage swap, matching the label cropper so both tools feel like one product. */
export const STAGE_TRANSITION = {
	initial: { opacity: 0, y: 16 },
	animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
	exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: EASE_IN } },
};

/** Press feedback, the same two strengths the label cropper uses: a wide button, a square one. */
export const TAP = { scale: 0.97 };
export const TAP_ICON = { scale: 0.94 };
export const TAP_CARD = { scale: 0.96 };

/** A file or row entering a short list and sliding out left when removed — the cropper's file rows. */
export function listRow(index = 0) {
	return {
		initial: { opacity: 0, y: 12, scale: 0.97 },
		animate: {
			opacity: 1,
			y: 0,
			scale: 1,
			transition: { duration: 0.35, ease: EASE_OUT, delay: Math.min(index, 6) * 0.04 },
		},
		exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
	};
}

/**
 * The slower cascade of a results screen. Matches the cropper's "Your labels are ready" panel, so
 * arriving at your profit feels like the same moment as arriving at your labels.
 */
export const RESULT_STAGGER: Variants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};

export const RESULT_ITEM: Variants = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** Height-and-fade for anything that opens in place, so the page reflows instead of jumping. */
export const COLLAPSE = {
	initial: { opacity: 0, height: 0 },
	animate: { opacity: 1, height: 'auto' },
	exit: { opacity: 0, height: 0 },
	transition: { duration: 0.28, ease: EASE_OUT },
};

interface AnimatedNumberProps {
	value: number;
	/** Formats the in-between values too, so the digits stay currency-shaped while counting. */
	format: (value: number) => string;
	className?: string;
}

/**
 * Counts from the previous figure to the new one.
 *
 * This is the one piece of motion here that carries meaning rather than polish: when a seller
 * fixes a SKU cost, the profit figure visibly *travels* to its new value, so they see the size of
 * what they just corrected instead of a number silently swapping underneath them.
 *
 * Writes through a ref rather than React state — a count-up is 60 renders a second otherwise.
 */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
	const reduced = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const motionValue = useMotionValue(value);
	// The first paint must be the real figure, not a zero that animates up: server-rendered text
	// and the reduced-motion path both need something correct to show immediately.
	const [initial] = useState(() => format(value));

	useEffect(() => {
		const node = ref.current;
		if (!node) return;

		if (reduced) {
			node.textContent = format(value);
			return;
		}

		const controls = animate(motionValue, value, {
			duration: 0.7,
			ease: EASE_OUT,
			onUpdate: (latest) => {
				node.textContent = format(latest);
			},
		});
		return () => controls.stop();
	}, [value, format, motionValue, reduced]);

	return (
		<span ref={ref} className={className}>
			{initial}
		</span>
	);
}

/**
 * A horizontal meter that springs to its new width.
 *
 * `value` is a fraction 0–1; anything outside is clamped, because a share of a total that exceeds
 * the total is a bug upstream and shouldn't paint outside its track.
 */
export function ProgressMeter({
	value,
	className,
	trackClassName,
}: {
	value: number;
	className?: string;
	trackClassName?: string;
}) {
	const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
	return (
		<div className={trackClassName ?? 'h-1.5 w-full overflow-hidden rounded-full bg-muted'}>
			<motion.div
				className={className ?? 'h-full rounded-full bg-primary'}
				initial={{ scaleX: 0 }}
				animate={{ scaleX: clamped }}
				transition={SOFT_SPRING}
				style={{ transformOrigin: 'left' }}
			/>
		</div>
	);
}

/** Fades and lifts its children in on mount. Sugar over the stagger item, for one-off blocks. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: EASE_OUT, delay }}
			className={className}
		>
			{children}
		</motion.div>
	);
}
