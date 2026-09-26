import { CheckIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from 'cn';

const STEPS = ['Upload', 'Customize', 'Download'] as const;

interface StepIndicatorProps {
	/** 0-based index of the current step. */
	current: number;
	/** Called when a *completed* step is tapped — lets the user jump back without hunting for a back button. */
	onStepClick?: (index: number) => void;
	/** Overrides the cropper's own labels; the profit calculator runs a different three. */
	steps?: readonly string[];
}

/** Three-step progress header: numbered dots joined by a track that fills as the user advances. Completed
 * steps turn into check marks and become tappable back-links. */
export function StepIndicator({ current, onStepClick, steps = STEPS }: StepIndicatorProps) {
	return (
		<nav aria-label="Progress" className="mx-auto w-full max-w-md px-2">
			<ol className="relative flex items-start justify-between">
				{/* Track sits behind the dots, inset by half a step on each end so it runs
				  * centre-to-centre. The inset depends on how many steps there are, so it's an
				  * inline style — a Tailwind class can't be built from a runtime value. */}
				<div
					className="absolute top-4 h-0.5 -translate-y-1/2 rounded-full bg-border"
					style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
					aria-hidden="true"
				>
					<motion.div
						className="h-full origin-left rounded-full bg-primary"
						initial={false}
						animate={{ scaleX: current / (steps.length - 1) }}
						transition={{ type: 'spring', stiffness: 120, damping: 20 }}
					/>
				</div>

				{steps.map((label, index) => {
					const done = index < current;
					const active = index === current;
					const clickable = done && onStepClick;
					return (
						<li key={label} className="relative z-10 flex flex-1 flex-col items-center gap-1.5">
							<button
								type="button"
								disabled={!clickable}
								onClick={() => clickable && onStepClick(index)}
								aria-current={active ? 'step' : undefined}
								// The name has to contain the digit shown in the dot: speech-input users say what
								// they see ("click 2"), and a name of just "Customize" wouldn't match it.
								aria-label={done ? `${label} (done — go back)` : `Step ${index + 1}: ${label}`}
								className={cn(
									'relative flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300',
									// A 32px dot is the right size to look at and too small to hit with a
									// thumb. The pseudo-element widens the target to 48px without moving
									// anything, and the steps either side are far enough apart not to overlap.
									'before:absolute before:-inset-2 before:content-[""]',
									done && 'bg-primary text-primary-foreground',
									active && 'bg-primary text-primary-foreground ring-4 ring-primary/15',
									!done && !active && 'border border-border bg-background text-muted-foreground',
									clickable ? 'cursor-pointer' : 'cursor-default',
								)}
							>
								{done ? (
									<motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
										<CheckIcon className="size-4" strokeWidth={3} />
									</motion.span>
								) : (
									index + 1
								)}
							</button>
							<span
								className={cn(
									'text-xs font-medium transition-colors duration-300',
									active ? 'text-foreground' : 'text-muted-foreground',
								)}
							>
								{label}
							</span>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
