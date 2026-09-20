import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { cn } from 'cn';
import { formatCurrency, formatNumber } from '../format';
import { buildStatusSlices } from '../status';
import type { StatusRow } from '../types';
import { ChartCard } from './ChartCard';
import { useChartMotion } from './theme';

interface StatusDonutProps {
	breakdown: StatusRow[];
}

export function StatusDonut({ breakdown }: StatusDonutProps) {
	const motion = useChartMotion();
	const [active, setActive] = useState<number | null>(null);
	if (breakdown.length === 0) return null;

	// Which statuses earn a slice, what they are called and what colour they are: shared with the
	// donut in the downloaded report, so the two can't disagree about what got folded into "Other".
	const { slices: data, total } = buildStatusSlices(breakdown);

	const hovered = active === null ? null : (data[active] ?? null);

	return (
		<ChartCard
			title="How orders ended up"
			caption="Deliveries earn; returns cost you the packaging and often the item too."
			badge={`${formatNumber(total)} orders`}
		>
			{/* Stacked, not side by side: this card now lives in a 20rem column, which is not wide
			  * enough to put a donut and seven legend rows next to each other. */}
			<div className="flex h-full flex-col items-center justify-center gap-5">
				<div className="relative h-44 w-44 shrink-0">
					<ResponsiveContainer>
						<PieChart>
							<Pie
								data={data}
								cx="50%"
								cy="50%"
								innerRadius={54}
								outerRadius={82}
								paddingAngle={1.5}
								dataKey="value"
								/* A 2px ring in the card colour, which is what separates touching
								 * slices. A stroke in a *contrasting* colour would be drawing a border
								 * around each mark — ink that isn't data. */
								stroke="var(--card)"
								strokeWidth={2}
								onMouseEnter={(_, index) => setActive(index)}
								onMouseLeave={() => setActive(null)}
								{...motion}
							>
								{data.map((entry, index) => (
									<Cell
										key={entry.name}
										className={cn(
											entry.fill,
											'transition-opacity duration-150',
											// The hovered slice stays lit and the rest step back, which is
											// what tells you which one the readout belongs to.
											active !== null && active !== index && 'opacity-30',
										)}
									/>
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
					{/* The hole *is* the tooltip.
					  *
					  * Recharts' floating tooltip follows the cursor, and on a 176px donut the cursor is
					  * never more than ~90px from the centre — so the panel landed squarely on top of the
					  * total and the two sets of type overprinted each other. Reading the hovered slice
					  * out of the centre instead means nothing can ever collide: the total is what the
					  * donut says at rest, the slice is what it says under the pointer.
					  *
					  * Centred as HTML rather than an SVG <text>, so it inherits the page font and theme
					  * colours instead of needing them restated in SVG attributes. Sized to the hole
					  * (innerRadius 54 → 108px) so long status names wrap inside it rather than over the
					  * ring, and pointer-transparent so it never steals hover from the slice beneath. */}
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
						{hovered ? (
							<div className="w-[6.75rem] leading-tight">
								<p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
									{hovered.name}
								</p>
								<p className="text-2xl font-semibold tabular-nums tracking-tight">
									{formatNumber(hovered.value)}
								</p>
								<p className="text-[11px] tabular-nums text-muted-foreground">
									{hovered.percentage.toFixed(1)}% · {formatCurrency(hovered.settlement)}
								</p>
								{hovered.parts && (
									<p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground/80">
										{hovered.parts.join(' · ')}
									</p>
								)}
							</div>
						) : (
							<>
								<span className="text-3xl font-semibold tracking-tight">{formatNumber(total)}</span>
								<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									Orders
								</span>
							</>
						)}
					</div>
				</div>

				{/* The legend is the accessible channel — every slice is named and counted here, so
				  * the donut never has to be read by colour alone. 14px, because it is the part
				  * people actually read; it was set at 12 and the counts beside it at 12 too.
				  *
				  * Hovering a row drives the same readout as hovering its slice: the rows are wider
				  * targets than a 28px ring, and on a narrow card they are what the thumb reaches. */}
				<ul className="w-full space-y-2">
					{data.map((d, index) => (
						<li
							key={d.name}
							className={cn(
								// The negative margin lets the hover band breathe past the text without
								// nudging the rows in or out as it appears.
								'-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-0.5 text-sm transition-colors',
								active === index && 'bg-muted/60',
							)}
							onMouseEnter={() => setActive(index)}
							onMouseLeave={() => setActive(null)}
						>
							<span className="flex min-w-0 items-center gap-2.5">
								<span className={cn('size-2.5 shrink-0 rounded-full', d.dot)} aria-hidden="true" />
								<span className="truncate">{d.name}</span>
							</span>
							<span className="shrink-0 tabular-nums text-muted-foreground">
								{formatNumber(d.value)} · {d.percentage.toFixed(0)}%
							</span>
						</li>
					))}
				</ul>
			</div>
		</ChartCard>
	);
}
