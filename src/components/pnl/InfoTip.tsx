import { Popover } from '@base-ui/react/popover';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from 'cn';

interface InfoTipProps {
	/** What the icon explains, for screen readers — "About courier returns". */
	label: string;
	children: ReactNode;
	/** Words beside the icon, when the ⓘ alone would be too cryptic to tap. */
	text?: ReactNode;
	side?: 'top' | 'bottom' | 'left' | 'right';
	className?: string;
}

/**
 * The ⓘ beside a setting: the explanation stays out of the way until someone asks for it.
 *
 * A popover rather than a tooltip because the site's main device has no hover — a tooltip never
 * opens on a tap, so on a phone the explanation would simply not exist. This opens on hover for a
 * mouse and on tap or Enter for everyone else.
 */
export function InfoTip({ label, children, text, side = 'top', className }: InfoTipProps) {
	return (
		<Popover.Root>
			<Popover.Trigger
				openOnHover
				delay={150}
				closeDelay={100}
				aria-label={text ? undefined : label}
				className={cn(
					// 32px of tap target around a 16px glyph — enough for a thumb without shoving the
					// label it sits beside out of line.
					'-m-2 inline-flex shrink-0 items-center gap-1.5 rounded-full p-2 text-muted-foreground',
					'transition-colors hover:text-foreground data-popup-open:text-primary',
					'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
					className,
				)}
			>
				<InfoIcon className="size-4" aria-hidden="true" />
				{text && <span className="text-xs font-medium">{text}</span>}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Positioner side={side} sideOffset={6} collisionPadding={16} className="z-50">
					<Popover.Popup
						className={cn(
							'w-max max-w-[min(17rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-xl border border-border',
							'bg-popover px-3.5 py-2.5 text-sm leading-relaxed text-popover-foreground shadow-xl outline-none',
							'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
							'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
						)}
					>
						{children}
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}
