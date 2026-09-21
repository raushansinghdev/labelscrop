import { ChevronDownIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from 'cn';

interface ListCardProps {
	title: ReactNode;
	/** Quiet right-hand note in the header — a count, a total, a date. */
	meta?: ReactNode;
	/** Buttons that belong to the whole list (Import, Export). Sit under the title on a phone. */
	actions?: ReactNode;
	/** "Show all N" / "Show less" footer, when the list is trimmed. */
	more?: { expanded: boolean; label: string; onToggle: () => void };
	className?: string;
	children: ReactNode;
}

/**
 * The label cropper's list card — its "Pick list" and "By courier" panels — for the profit
 * calculator's tables. One header row that says what the list is and how long it is, then rows,
 * then an optional way to see the rest. Keeping every list in this one frame is most of what makes
 * the two tools read as one product.
 */
export function ListCard({ title, meta, actions, more, className, children }: ListCardProps) {
	return (
		<section className={cn('overflow-hidden rounded-2xl border border-border bg-card', className)}>
			<header
				className={cn(
					'flex gap-3 border-b border-border px-4 py-3',
					actions ? 'flex-col sm:flex-row sm:items-center' : 'items-center',
				)}
			>
				<div className="flex min-w-0 flex-1 items-center justify-between gap-3">
					<h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">{title}</h2>
					{meta && <div className="shrink-0 text-xs text-muted-foreground tabular-nums">{meta}</div>}
				</div>
				{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
			</header>

			{children}

			{more && (
				<button
					type="button"
					onClick={more.onToggle}
					aria-expanded={more.expanded}
					className="flex min-h-12 w-full items-center justify-center gap-1.5 border-t border-border px-4 text-sm font-semibold text-primary transition-colors hover:bg-muted/50 active:bg-muted/60"
				>
					{more.label}
					<ChevronDownIcon className={cn('size-4 transition-transform duration-200', more.expanded && 'rotate-180')} />
				</button>
			)}
		</section>
	);
}

/** The small grey count pill the cropper puts at the end of a pick-list row. */
export function CountChip({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums',
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * The "More options" disclosure from the cropper's options form, for anything a seller will
 * rarely open but should be able to find.
 */
export function Disclosure({
	icon,
	title,
	hint,
	badge,
	open,
	onOpenChange,
	id,
	children,
}: {
	icon?: ReactNode;
	title: string;
	hint?: string;
	/** Shown only while closed, and pops in — a count of settings that aren't at their default. */
	badge?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	id: string;
	children: ReactNode;
}) {
	return (
		<div className="rounded-2xl border border-border bg-muted/30">
			<button
				type="button"
				onClick={() => onOpenChange(!open)}
				aria-expanded={open}
				aria-controls={id}
				className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
			>
				{icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-semibold">{title}</span>
					{hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span>}
				</span>
				{badge && !open && (
					<motion.span
						initial={{ opacity: 0, scale: 0.6 }}
						animate={{ opacity: 1, scale: 1 }}
						className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
					>
						{badge}
					</motion.span>
				)}
				<motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
					<ChevronDownIcon className="size-4 text-muted-foreground" />
				</motion.span>
			</button>
			{children}
		</div>
	);
}
