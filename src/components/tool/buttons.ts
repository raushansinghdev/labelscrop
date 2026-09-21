import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';

/*
 * The two buttons every step of every tool ends on. Both tools import these rather than spelling
 * the classes out, so the label cropper and the profit calculator can't drift into two different
 * ideas of what "the next step" looks like.
 */

/** The one thing to press next: full height for a thumb, and the only filled button on screen. */
export const primaryCta = cn(
	buttonVariants({ size: 'lg' }),
	'h-14 flex-1 gap-2 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 transition-[transform,background-color,box-shadow]',
);

/** The square way back that sits beside it. Icon-only, so it always needs an `aria-label`. */
export const backButton = cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'size-14 shrink-0 rounded-2xl bg-background');

/** Secondary actions at the foot of a result screen ("Change options", "New batch"). */
export const ghostAction = cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'h-12 gap-2 rounded-2xl');

/** Smaller outlined actions inside a card header (Import, Export). */
export const outlineAction = cn(buttonVariants({ variant: 'outline' }), 'h-10 gap-2 rounded-xl px-3.5');
