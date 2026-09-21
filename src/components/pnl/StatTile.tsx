import type { ReactNode } from 'react';
import { cn } from 'cn';
import { MetricTooltip, type MetricRow } from './MetricTooltip';

interface StatTileProps {
	label: ReactNode;
	value: ReactNode;
	/** One quiet line under the label — what the figure is made of. */
	hint?: ReactNode;
	valueClassName?: string;
	align?: 'center' | 'left';
	className?: string;
	/** When given, the tile becomes a button that opens the working behind the figure. */
	explain?: { title: string; meaning: string; rows: MetricRow[]; footnote?: string };
}

/**
 * The label cropper's result tile ("9 Labels · 3 Pages to print · 5 SKUs"): a soft grey block, a
 * big number, a small caption. No border, no icon — the figure is the whole point.
 */
export function StatTile({ label, value, hint, valueClassName, align = 'center', className, explain }: StatTileProps) {
	const body = (
		<>
			<span className={cn('block text-2xl font-bold tracking-tight tabular-nums', valueClassName)}>{value}</span>
			<span className="mt-0.5 block text-xs text-muted-foreground">{label}</span>
			{hint && <span className="mt-1 block text-xs leading-snug text-muted-foreground/80">{hint}</span>}
		</>
	);

	const tile = cn(
		'block w-full min-w-0 rounded-2xl bg-muted/60 px-3 py-3',
		align === 'center' ? 'text-center' : 'text-left',
		className,
	);

	if (!explain) return <div className={tile}>{body}</div>;

	return (
		<MetricTooltip
			{...explain}
			className={cn(tile, align === 'center' && 'text-center', 'transition-colors hover:bg-muted active:bg-muted')}
		>
			{body}
		</MetricTooltip>
	);
}
