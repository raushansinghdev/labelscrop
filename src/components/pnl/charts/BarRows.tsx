import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { AnimatedNumber } from '../motion';
import { BAR_HEIGHT, barTransition, compactInr, useChartReveal, useElementWidth } from './theme';

export interface BarRow {
	key: string;
	/** Shown in the name gutter; truncated there, so `title` carries the full name. */
	label: string;
	title?: string;
	/** Where the bar starts on the value axis — it grows *from* here, so a cost visibly travels left. */
	from: number;
	to: number;
	/** The figure printed at the bar's tip. */
	value: number;
	/** A `bg-*` utility. Real class names, never `var()` strings. */
	barClass: string;
	/** The closing total: bold figure, and a sheen that sweeps across it now and then. */
	emphasis?: boolean;
	/** Drops a dashed hairline from this bar's end to the next bar — what makes a waterfall a bridge. */
	connect?: boolean;
	/** Small mark after the name, e.g. a "no cost yet" dot. */
	marker?: ReactNode;
	/** What the readout under the chart says while this row is active. */
	detail: ReactNode;
}

interface BarRowsProps {
	rows: BarRow[];
	domain: [number, number];
	ticks: number[];
	labelWidth: number;
	valueWidth: number;
	/** Formats the tip figure, including while it counts. Must be a stable reference. */
	format: (value: number) => string;
	/** What the readout says before anything is picked. */
	hint: string;
	/** Rows slide to their new place when the order changes (SKUs re-ranking after a cost edit). */
	reorder?: boolean;
	rowHeight?: number;
}

/**
 * Horizontal bars, drawn by hand: a name gutter, a plot, a figure at every tip, and a readout
 * underneath that says what the picked bar is made of.
 *
 * The readout replaces a floating tooltip. A tooltip only exists under a mouse; this answers a
 * tap on a phone, a hover on a laptop and a Tab from a keyboard the same way, and it can never
 * land on top of the thing it describes.
 */
export function BarRows({
	rows,
	domain,
	ticks,
	labelWidth,
	valueWidth,
	format,
	hint,
	reorder = false,
	rowHeight = 40,
}: BarRowsProps) {
	const { ref, revealed, settled, reduced } = useChartReveal<HTMLDivElement>();
	const plotRef = useRef<HTMLDivElement>(null);
	const plotWidth = useElementWidth(plotRef);
	const [hovered, setHovered] = useState<string | null>(null);
	const [pinned, setPinned] = useState<string | null>(null);

	const activeKey = hovered ?? pinned;
	const active = rows.find((r) => r.key === activeKey) ?? null;

	const [low, high] = domain;
	const span = Math.max(1, high - low);
	const pct = (v: number) => ((v - low) / span) * 100;
	const barTop = (rowHeight - BAR_HEIGHT) / 2;

	return (
		<div ref={ref}>
			<div className="relative">
				{/* Gridlines behind the rows, spanning the plot column only. The zero line is darker:
				  * it is the one line every bar is measured against. */}
				<div
					ref={plotRef}
					aria-hidden="true"
					className="pointer-events-none absolute top-0 bottom-0"
					style={{ left: labelWidth, right: valueWidth }}
				>
					{ticks.map((t) => (
						<span
							key={t}
							className={cn('absolute inset-y-0 w-px', t === 0 ? 'bg-foreground/25' : 'bg-border/70')}
							style={{ left: `${pct(t)}%` }}
						/>
					))}
				</div>

				<ul className="relative">
					{rows.map((row, index) => {
						const min = Math.min(row.from, row.to);
						const max = Math.max(row.from, row.to);
						const width = ((max - min) / span) * 100;
						const dimmed = activeKey !== null && activeKey !== row.key;
						const next = rows[index + 1];
						const transition = barTransition(index, settled, reduced);

						// A figure for a cost sits to the left of the bar, where the money went — unless
						// that would run it into the names, in which case it flips to the far end.
						const textWidth = format(row.value).length * 7 + 6;
						const leftRoom = (pct(min) / 100) * plotWidth;
						const anchorLeft = row.value < 0 && leftRoom - 6 > textWidth;

						return (
							<motion.li
								key={row.key}
								layout={reorder && settled ? 'position' : false}
								transition={{ type: 'spring', stiffness: 260, damping: 30 }}
							>
								<button
									type="button"
									title={row.title}
									aria-pressed={pinned === row.key}
									aria-label={`${row.title ?? row.label}: ${format(row.value)}`}
									onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(row.key)}
									onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(null)}
									onFocus={() => setHovered(row.key)}
									onBlur={() => setHovered(null)}
									onClick={() => setPinned((p) => (p === row.key ? null : row.key))}
									className={cn(
										'grid w-full items-center rounded-lg text-left transition-colors',
										'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
										activeKey === row.key && 'bg-muted/50',
									)}
									style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) ${valueWidth}px`, height: rowHeight }}
								>
									<span
										className={cn(
											'flex min-w-0 items-center justify-end gap-1.5 pr-3 text-xs transition-[color,opacity] duration-200 sm:text-[13px]',
											activeKey === row.key ? 'font-medium text-foreground' : 'text-muted-foreground',
											dimmed && 'opacity-40',
										)}
									>
										<span className="truncate">{row.label}</span>
										{row.marker}
									</span>

									<span
										className={cn('relative block h-full transition-opacity duration-200', dimmed && 'opacity-35')}
									>
										{/* The label rides inside the bar's own box, pinned past its tip, so the two can
										  * never drift apart while the bar is still growing. */}
										<motion.span
											className="absolute block"
											style={{ top: barTop, height: BAR_HEIGHT, minWidth: 3 }}
											initial={{ left: `${pct(row.from)}%`, width: '0%', opacity: 0 }}
											animate={
												revealed
													? { left: `${pct(min)}%`, width: `${width}%`, opacity: 1 }
													: { left: `${pct(row.from)}%`, width: '0%', opacity: 0 }
											}
											transition={transition}
										>
											<span className={cn('absolute inset-0 overflow-hidden rounded-md', row.barClass)}>
												{/* A soft top light, so a bar reads as a solid thing rather than a flat swatch. */}
												<span className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
												{row.emphasis && !reduced && revealed && (
													<motion.span
														className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
														initial={{ x: '-120%' }}
														animate={{ x: '320%' }}
														transition={{
															duration: 1.1,
															ease: 'easeInOut',
															delay: 0.9 + index * 0.08,
															repeat: Infinity,
															repeatDelay: 5,
														}}
													/>
												)}
											</span>
											<span
												className={cn(
													'absolute inset-y-0 flex items-center whitespace-nowrap text-xs tabular-nums',
													anchorLeft ? 'right-full pr-1.5' : 'left-full pl-1.5',
													row.emphasis ? 'font-bold' : 'font-medium',
													row.emphasis
														? row.value >= 0
															? 'text-success'
															: 'text-destructive'
														: 'text-foreground',
												)}
											>
												<AnimatedNumber value={revealed ? row.value : 0} format={format} />
											</span>
										</motion.span>

										{row.connect && next && (
											<motion.span
												aria-hidden="true"
												className="absolute w-0 border-l border-dashed border-foreground/30"
												style={{ top: barTop + BAR_HEIGHT, height: rowHeight - BAR_HEIGHT }}
												initial={{ left: `${pct(row.to)}%`, opacity: 0 }}
												animate={{ left: `${pct(row.to)}%`, opacity: revealed ? 1 : 0 }}
												transition={
													reduced
														? { duration: 0 }
														: settled
															? { type: 'spring', stiffness: 140, damping: 22 }
															: { duration: 0.3, delay: 0.55 + (index + 1) * 0.08 }
												}
											/>
										)}
									</span>
									<span aria-hidden="true" />
								</button>
							</motion.li>
						);
					})}
				</ul>
			</div>

			<div
				aria-hidden="true"
				className="relative h-7 text-xs text-muted-foreground tabular-nums"
				style={{ marginLeft: labelWidth, marginRight: valueWidth }}
			>
				{ticks.map((t) => (
					<span key={t} className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(t)}%` }}>
						{compactInr(t)}
					</span>
				))}
			</div>

			{/* The readout. Fixed minimum height so picking a row doesn't shove the page about. */}
			<div className="mt-2 min-h-[4.25rem] rounded-xl bg-muted/50 px-3.5 py-3 text-sm" aria-live="polite">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={active?.key ?? 'hint'}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: reduced ? 0 : 0.16 }}
					>
						{active ? (
							<>
								<p className="font-semibold">{active.title ?? active.label}</p>
								<div className="mt-0.5 space-y-0.5 leading-relaxed text-muted-foreground">{active.detail}</div>
							</>
						) : (
							<p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
