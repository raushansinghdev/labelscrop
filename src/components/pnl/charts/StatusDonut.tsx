import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { cn } from 'cn';
import { formatCurrency, formatNumber } from '../format';
import { AnimatedNumber } from '../motion';
import { buildStatusSlices } from '../status';
import type { StatusRow } from '../types';
import { ChartCard } from './ChartCard';
import { useChartReveal } from './theme';

interface StatusDonutProps {
	breakdown: StatusRow[];
}

/** Ring geometry in a 200-unit viewBox. The stroke is the slice, so the hole is r − width/2. */
const R = 72;
const WIDTH = 26;
const ACTIVE_WIDTH = 34;
const C = 2 * Math.PI * R;
/** A hairline of card between touching slices — the gap, not a border, is what separates them. */
const GAP = C * 0.006;
/** How long the whole ring takes to fill on entrance; each slice gets its share of it. */
const SWEEP = 0.9;

const wholeNumber = (value: number) => formatNumber(Math.round(value));

export function StatusDonut({ breakdown }: StatusDonutProps) {
	const { ref, revealed, settled, reduced } = useChartReveal<HTMLDivElement>();
	const [hovered, setHovered] = useState<number | null>(null);
	const [pinned, setPinned] = useState<number | null>(null);
	if (breakdown.length === 0) return null;

	// Which statuses earn a slice, what they are called and what colour they are: shared with the
	// donut in the downloaded report, so the two can't disagree about what got folded into "Other".
	const { slices: data, total } = buildStatusSlices(breakdown);

	const activeIndex = hovered ?? pinned;
	const active = activeIndex === null ? null : (data[activeIndex] ?? null);

	// Start of each slice, as a fraction of the ring.
	let cursor = 0;
	const arcs = data.map((d) => {
		const fraction = total > 0 ? d.value / total : 0;
		const start = cursor;
		cursor += fraction;
		return { start, fraction, length: Math.max(0, fraction * C - (data.length > 1 ? GAP : 0)) };
	});

	/** Entrance: the ring fills clockwise from 12 o'clock as one continuous sweep. Later: springs. */
	const arcTransition = (start: number, fraction: number) =>
		reduced
			? { duration: 0 }
			: settled
				? { type: 'spring' as const, stiffness: 160, damping: 24 }
				: { duration: Math.max(0.12, fraction * SWEEP), delay: 0.15 + start * SWEEP, ease: 'linear' as const };

	const pick = (index: number) => setPinned((p) => (p === index ? null : index));

	return (
		<ChartCard
			title="How orders ended up"
			caption="Deliveries earn; returns cost you the packaging and often the item too."
			badge={`${formatNumber(total)} orders`}
		>
			<div ref={ref} className="flex h-full flex-col items-center justify-center gap-5">
				<div className="relative size-44 shrink-0">
					<svg viewBox="0 0 200 200" className="size-full" role="img" aria-label={`${formatNumber(total)} orders by outcome`}>
						<circle cx="100" cy="100" r={R} fill="none" strokeWidth={WIDTH} className="stroke-muted/60" />
						<g transform="rotate(-90 100 100)">
							{data.map((d, index) => {
								const arc = arcs[index];
								const lit = activeIndex === null || activeIndex === index;
								return (
									<motion.circle
										key={d.name}
										cx="100"
										cy="100"
										r={R}
										fill="none"
										className={cn(d.stroke, 'cursor-pointer transition-opacity duration-200', !lit && 'opacity-30')}
										initial={{ strokeDasharray: `0 ${C}`, strokeDashoffset: -arc.start * C, strokeWidth: WIDTH }}
										animate={{
											strokeDasharray: revealed ? `${arc.length} ${C}` : `0 ${C}`,
											strokeDashoffset: -arc.start * C,
											strokeWidth: activeIndex === index ? ACTIVE_WIDTH : WIDTH,
										}}
										transition={{
											default: arcTransition(arc.start, arc.fraction),
											strokeWidth: reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 26 },
										}}
										onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(index)}
										onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(null)}
										onClick={() => pick(index)}
									/>
								);
							})}
						</g>
					</svg>

					{/* The hole *is* the readout: the total at rest, the picked slice when there is one.
					  * HTML rather than SVG text, so it inherits the page font and theme colours. */}
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
						<AnimatePresence mode="wait" initial={false}>
							{active ? (
								<motion.div
									key={active.name}
									initial={{ opacity: 0, scale: 0.92 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.92 }}
									transition={{ duration: reduced ? 0 : 0.14 }}
									className="w-[6.5rem] leading-tight"
								>
									<p className="truncate text-[11px] font-medium text-muted-foreground">{active.name}</p>
									<p className="text-2xl font-bold tabular-nums tracking-tight">{formatNumber(active.value)}</p>
									<p className="text-[11px] tabular-nums text-muted-foreground">
										{active.percentage.toFixed(1)}% · {formatCurrency(active.settlement)}
									</p>
								</motion.div>
							) : (
								<motion.div
									key="total"
									initial={{ opacity: 0, scale: 0.92 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.92 }}
									transition={{ duration: reduced ? 0 : 0.14 }}
									className="flex flex-col items-center"
								>
									<AnimatedNumber
										value={revealed ? total : 0}
										format={wholeNumber}
										className="text-3xl font-bold tracking-tight tabular-nums"
									/>
									<span className="text-xs font-medium text-muted-foreground">orders</span>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				{/* The legend is the accessible channel — every slice named and counted, so the donut is
				  * never read by colour alone — and the wider target for a thumb. Each row carries a
				  * thin share bar that fills alongside its slice. */}
				<ul className="w-full space-y-1">
					{data.map((d, index) => {
						const arc = arcs[index];
						const isActive = activeIndex === index;
						return (
							<li key={d.name}>
								<button
									type="button"
									aria-pressed={pinned === index}
									onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(index)}
									onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(null)}
									onFocus={() => setHovered(index)}
									onBlur={() => setHovered(null)}
									onClick={() => pick(index)}
									className={cn(
										'relative -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left text-sm transition-opacity',
										'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
										activeIndex !== null && !isActive && 'opacity-50',
									)}
								>
									{isActive && (
										<motion.span
											layoutId="donut-legend-pill"
											className="absolute inset-0 rounded-lg bg-muted/70"
											transition={{ type: 'spring', stiffness: 420, damping: 34 }}
										/>
									)}
									<span className="relative flex items-center justify-between gap-3">
										<span className="flex min-w-0 items-center gap-2.5">
											<span className={cn('size-2.5 shrink-0 rounded-full', d.dot)} aria-hidden="true" />
											<span className="truncate">{d.name}</span>
										</span>
										<span className="shrink-0 tabular-nums text-muted-foreground">
											{formatNumber(d.value)} · {d.percentage.toFixed(0)}%
										</span>
									</span>
									<span className="relative mt-1.5 ml-5 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
										<motion.span
											className={cn('absolute inset-y-0 left-0 block rounded-full', d.dot)}
											initial={{ width: '0%' }}
											animate={{ width: revealed ? `${Math.min(100, arc.fraction * 100)}%` : '0%' }}
											transition={arcTransition(arc.start, arc.fraction)}
										/>
									</span>
									{d.parts && isActive && (
										<span className="relative mt-1 ml-5 block text-xs text-muted-foreground">{d.parts.join(' · ')}</span>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</ChartCard>
	);
}
