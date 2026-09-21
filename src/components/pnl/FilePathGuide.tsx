import { ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { EASE_OUT } from './motion';

/**
 * The exact clicks that produce the file this tool needs.
 *
 * Almost everything else about this tool is obvious once a file is loaded; getting the file is the
 * one step that happens somewhere else, on a panel with four different downloads behind one button.
 * A seller who picks "GST Report" or "Tax Invoice" gets a spreadsheet that looks plausible and
 * parses to nothing, and has no way of knowing which of the five they were supposed to choose.
 *
 * It only appears while the dropzone is empty: once the file is in, this is answered.
 */
const PATH = ['Supplier panel', 'Payments', 'Download', 'Payments to Date', 'Pick your dates'];

export function FilePathGuide() {
	return (
		<motion.section
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -6 }}
			transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.1 }}
			className="rounded-2xl bg-muted/40 p-4"
		>
			<div className="flex items-baseline justify-between gap-3">
				<h2 className="text-sm font-semibold tracking-tight">Where to find this file</h2>
				<a
					href="https://supplier.meesho.com"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
				>
					Open panel
					<ExternalLinkIcon className="size-3" aria-hidden="true" />
				</a>
			</div>

			{/* A wrapping row rather than a numbered list down the page: it is one path, and five
			  * stacked lines make five clicks look like five chores. */}
			<ol className="mt-3.5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
				{PATH.map((step, index) => (
					<motion.li
						key={step}
						initial={{ opacity: 0, x: -6 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.15 + index * 0.06 }}
						className="flex items-center gap-1"
					>
						<span className="inline-flex items-center gap-2 rounded-full bg-background py-1 pr-3 pl-1 text-sm font-medium shadow-xs ring-1 ring-border">
							<span
								className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
								aria-hidden="true"
							>
								{index + 1}
							</span>
							{step}
						</span>
						{index < PATH.length - 1 && (
							<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						)}
					</motion.li>
				))}
			</ol>

			<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
				It downloads as <code className="rounded bg-background px-1 py-0.5 font-mono">*_PAYMENT_FILE_*.xlsx</code>.
				Those dates are <strong className="font-medium text-foreground">payment</strong> dates, not order dates, so
				the file usually holds orders placed weeks earlier.
			</p>
		</motion.section>
	);
}
