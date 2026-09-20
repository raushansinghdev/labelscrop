import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SPRING } from './motion';

export interface TabDef<T extends string> {
	value: T;
	label: string;
	icon: LucideIcon;
	/** Rendered as a pill on the tab — used for the count of SKUs still missing a cost. */
	badge?: number;
}

interface TabBarProps<T extends string> {
	tabs: TabDef<T>[];
	active: T;
}

/**
 * The dashboard's segmented control.
 *
 * Base UI's `Tabs.Tab` is kept underneath for the keyboard and ARIA behaviour (roving focus, arrow
 * keys, `aria-selected`), but the default styling is replaced: it renders an 8px-tall strip, which
 * is an unusable touch target on the phone this tool is mostly opened on.
 *
 * The selected background is a single element that moves between tabs via `layoutId` rather than a
 * background that fades in and out per tab. The difference matters — a sliding pill tells you which
 * way you moved through the tool, and the tool's tabs are a sequence, not a set of peers.
 */
export function TabBar<T extends string>({ tabs, active }: TabBarProps<T>) {
	return (
		<TabsList
			variant="line"
			// All four tabs share the width evenly and always fit — no horizontal scroll, which on a
			// phone is a gesture nobody discovers on a row that looks like it's already showing you
			// everything.
			// `h-auto!` is deliberate: the list's own variant sets `h-8` through a data-attribute
			// selector, which outranks a plain utility, so the container stayed 32px tall while the
			// 40px triggers inside it spilled out of their own background.
			className="h-auto! w-full gap-0.5 rounded-xl border border-border bg-muted/50 p-1"
		>
			{tabs.map((tab) => {
				const selected = tab.value === active;
				const Icon = tab.icon;
				return (
					<TabsTrigger
						key={tab.value}
						value={tab.value}
						className={cn(
							'relative h-11 min-w-0 flex-1 rounded-lg px-2 text-sm font-medium transition-colors duration-200 sm:h-10 sm:px-3',
							// The "line" variant already keeps the trigger's own background transparent,
							// which the moving pill needs — but it also draws an underline on the active
							// tab. Two selection indicators for one selection, so the underline goes.
							'after:hidden',
							selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
						)}
					>
						{selected && (
							<motion.span
								layoutId="pnl-tab-pill"
								transition={SPRING}
								className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border/60"
								aria-hidden="true"
							/>
						)}
						{/* Above the pill, which is absolutely positioned behind it. */}
						<span className="relative z-10 flex items-center gap-1.5">
							{/* Icons are dropped on phones. Four labelled tabs with icons overflow a
							  * 390px screen, and the row then opens scrolled with the first tab
							  * sliced in half — which reads as broken, not as scrollable. */}
							<Icon className="hidden size-4 sm:block" aria-hidden="true" />
							<span>{tab.label}</span>
							{tab.badge !== undefined && tab.badge > 0 && (
								<motion.span
									// Pops rather than appears: a count arriving mid-session is news.
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={SPRING}
									className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold tabular-nums text-white"
								>
									{tab.badge}
								</motion.span>
							)}
						</span>
					</TabsTrigger>
				);
			})}
		</TabsList>
	);
}
