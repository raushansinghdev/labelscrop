import { CheckIcon, DownloadIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { formatDateRange, formatNumber } from './format';
import { EASE_OUT, SPRING } from './motion';
import type { ExpenseRow } from './expenses';
import type { PnlResult } from './types';

interface DownloadReportProps {
	result: PnlResult;
	overheads: number;
	expenses: ExpenseRow[];
	expenseDays: number;
	fileNames: string[];
}

type State = 'idle' | 'working' | 'done' | 'error';

/**
 * The overview, as a PDF — offered at the end of the overview, which is the point at which a
 * seller has read the thing they might want to keep.
 *
 * It sat in the file bar at the top for one release, beside "New file", and that was wrong twice
 * over: next to the name of the spreadsheet they just uploaded, "Download PDF" reads as an offer
 * to hand that file back, and a bare button never says what the thing it produces *is*. So it is
 * a card with a name, a sentence about what is inside it and what it is for, and the period it
 * covers — the button is the last part of it rather than the whole of it.
 *
 * The builder is imported on click rather than with the island: it pulls in pdf-lib, which is
 * larger than the whole dashboard, and most visits never ask for a report at all.
 */
export function DownloadReport({ result, overheads, expenses, expenseDays, fileNames }: DownloadReportProps) {
	const [state, setState] = useState<State>('idle');
	const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (resetTimer.current) clearTimeout(resetTimer.current);
		};
	}, []);

	const download = useCallback(async () => {
		if (state === 'working') return;
		setState('working');
		try {
			const { buildProfitReportPdf } = await import('@/lib/pnl/report/profitReport');
			const bytes = await buildProfitReportPdf({ result, overheads, expenses, expenseDays, fileNames });

			const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = reportFilename(result);
			link.click();
			// Safari needs the URL to outlive the click; a minute is far longer than any save takes.
			setTimeout(() => URL.revokeObjectURL(url), 60_000);

			setState('done');
			resetTimer.current = setTimeout(() => setState('idle'), 2500);
		} catch (err) {
			console.error('Could not build the profit report', err);
			setState('error');
			resetTimer.current = setTimeout(() => setState('idle'), 5000);
		}
	}, [expenseDays, expenses, fileNames, overheads, result, state]);

	// Short, because the button is `shrink-0` in this row and a label that grows from "Download
	// PDF" to "Building your report…" shoves the paragraph beside it sideways mid-click. The long
	// version of each goes to the live region instead, where only a screen reader hears it.
	const label =
		state === 'working' ? 'Building…' : state === 'done' ? 'Saved' : state === 'error' ? 'Try again' : 'Download PDF';
	const status =
		state === 'working'
			? 'Building your profit report.'
			: state === 'done'
				? 'Report saved to your downloads.'
				: state === 'error'
					? 'The report could not be built.'
					: '';
	const Icon = state === 'working' ? Loader2Icon : state === 'done' ? CheckIcon : DownloadIcon;

	const period = formatDateRange(result.overall.payment_window_start, result.overall.payment_window_end);
	const covers = [
		period,
		`${formatNumber(result.overall.total_orders)} orders`,
		`${formatNumber(result.sku_rows.length)} products`,
	].filter(Boolean);

	return (
		<motion.section
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: EASE_OUT }}
			aria-labelledby="profit-report-heading"
			className={cn(
				'overflow-hidden rounded-3xl border border-primary/20 p-5 sm:p-6',
				// The one block on this screen that asks for something rather than reporting it, so
				// it carries the brand wash the site's other calls to action use.
				'bg-gradient-to-br from-primary/[0.07] via-card to-card',
			)}
		>
			<div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
				<span
					className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
					aria-hidden="true"
				>
					<FileTextIcon className="size-5.5" />
				</span>

				<div className="min-w-0 flex-1">
					<h3 id="profit-report-heading" className="text-base font-semibold tracking-tight">
						Your profit report
					</h3>
					<p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">
						Everything on this page as one PDF — the headline figures, a table of every product, and
						the costs and write-off rates you entered. Print it, file it with your books, or send it
						to your accountant.
					</p>
					{covers.length > 0 && (
						<p className="mt-2 text-xs text-muted-foreground/90">Covers {covers.join(' · ')}</p>
					)}
				</div>

				<motion.button
					type="button"
					onClick={() => void download()}
					disabled={state === 'working'}
					whileTap={{ scale: 0.97 }}
					transition={SPRING}
					className={cn(
						'group inline-flex h-12 min-w-44 shrink-0 items-center justify-center gap-2 rounded-2xl px-5',
						'text-base font-semibold transition-colors',
						'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
						'disabled:pointer-events-none',
						state === 'done'
							? 'bg-success text-success-foreground'
							: state === 'error'
								? 'bg-destructive/10 text-destructive'
								: 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90',
					)}
				>
					<Icon className={cn('size-4', state === 'working' && 'animate-spin')} aria-hidden="true" />
					{label}
				</motion.button>
			</div>

			<span role="status" aria-live="polite" className="sr-only">
				{status}
			</span>

			{state === 'error' ? (
				<p className="mt-4 border-t border-destructive/20 pt-3 text-xs text-destructive">
					The report could not be built. Your figures are all still here — try the button again, and if
					it keeps failing the browser console will say why.
				</p>
			) : (
				/* The same promise the upload screen makes, restated where it is easiest to doubt: a
				 * download feels like a round trip to a server, and this one isn't. */
				<p className="mt-4 border-t border-primary/10 pt-3 text-xs text-muted-foreground">
					Built in your browser from the file you opened — nothing is uploaded, and no one else sees it.
				</p>
			)}
		</motion.section>
	);
}

/**
 * `meesho-profit-20-08-2026-to-18-09-2026.pdf` — the period, not the day it was downloaded, so
 * two months of reports sort next to each other in a downloads folder and neither overwrites the
 * other. Matches the dd-mm-yyyy the label cropper names its files with.
 */
function reportFilename(result: PnlResult): string {
	const { payment_window_start, payment_window_end } = result.overall;
	const stamp = (iso: string) => {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
	};
	const from = stamp(payment_window_start);
	const to = stamp(payment_window_end);
	if (!from || !to) return 'meesho-profit-overview.pdf';
	return `meesho-profit-${from}-to-${to}.pdf`;
}
