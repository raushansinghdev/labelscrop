import { CheckIcon, DownloadIcon, FileTextIcon, Loader2Icon, RotateCcwIcon, Share2Icon } from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { backButton, primaryCta } from '@/components/tool/buttons';
import { triggerDownload, useShareFile } from '@/components/tool/useShareFile';
import { formatDateRange, formatNumber, parseIsoDate } from './format';
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

/** The built report: the Blob for sharing, an object URL for downloading. */
interface ReportPdf {
	blob: Blob;
	url: string;
}

/**
 * The overview as a PDF: a name, what it covers, and the cropper's download + share pair.
 *
 * The PDF is built as soon as the card scrolls into view rather than on the tap. Share has to be
 * called while the tap still counts as a user gesture, and phones stop counting after a few
 * seconds — longer than pdf-lib takes to load and draw on a slow one. Built ahead, both buttons
 * act instantly. pdf-lib is still only fetched by someone who scrolls this far.
 */
export function DownloadReport({ result, overheads, expenses, expenseDays, fileNames }: DownloadReportProps) {
	const ref = useRef<HTMLElement>(null);
	const inView = useInView(ref, { once: true, margin: '0px 0px 200px 0px' });
	const [pdf, setPdf] = useState<ReportPdf | null>(null);
	const [failed, setFailed] = useState(false);
	const [saved, setSaved] = useState(false);
	// Bumped by the button after a failed build, to try again.
	const [attempt, setAttempt] = useState(0);
	const filename = reportFilename(result);
	const namesKey = fileNames.join('\n');

	useEffect(() => {
		if (!inView) return;
		let cancelled = false;
		let built: string | null = null;
		// Dropped first, so a report of the old figures can't be downloaded while the new one builds.
		setPdf(null);
		setFailed(false);
		import('@/lib/pnl/report/profitReport')
			.then(({ buildProfitReportPdf }) =>
				buildProfitReportPdf({ result, overheads, expenses, expenseDays, fileNames: namesKey.split('\n') }),
			)
			.then((bytes) => {
				if (cancelled) return;
				const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
				built = URL.createObjectURL(blob);
				setPdf({ blob, url: built });
			})
			.catch((err) => {
				if (cancelled) return;
				console.error('Could not build the profit report', err);
				setFailed(true);
			});
		return () => {
			cancelled = true;
			// Safari needs a URL to outlive the click that used it; a minute is far longer than any save.
			if (built) {
				const url = built;
				setTimeout(() => URL.revokeObjectURL(url), 60_000);
			}
		};
	}, [inView, result, overheads, expenses, expenseDays, namesKey, attempt]);

	const { canShare, status: shareStatus, share } = useShareFile(pdf, filename);

	useEffect(() => {
		if (!saved) return;
		const timer = setTimeout(() => setSaved(false), 2500);
		return () => clearTimeout(timer);
	}, [saved]);

	const download = useCallback(() => {
		if (failed) {
			setAttempt((n) => n + 1);
			return;
		}
		if (!pdf) return;
		triggerDownload(pdf.url, filename);
		setSaved(true);
	}, [pdf, filename, failed]);

	const working = !pdf && !failed;
	const Icon = working ? Loader2Icon : saved ? CheckIcon : failed ? RotateCcwIcon : DownloadIcon;

	const period = formatDateRange(result.overall.payment_window_start, result.overall.payment_window_end);
	const covers = [
		period,
		`${formatNumber(result.overall.total_orders)} orders`,
		`${formatNumber(result.sku_rows.length)} products`,
	].filter(Boolean);

	return (
		<motion.section
			ref={ref}
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: EASE_OUT }}
			aria-labelledby="profit-report-heading"
			className={cn(
				'rounded-3xl border border-primary/20 p-4 sm:p-5',
				// The one block on this screen that asks for something rather than reporting it, so
				// it carries the brand wash the site's other calls to action use.
				'bg-gradient-to-br from-primary/[0.07] via-card to-card',
			)}
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<span
						className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary"
						aria-hidden="true"
					>
						<FileTextIcon className="size-5" />
					</span>
					<div className="min-w-0">
						<h3 id="profit-report-heading" className="text-base font-semibold tracking-tight">
							Your profit report
						</h3>
						{covers.length > 0 && (
							<p className="mt-0.5 text-sm text-muted-foreground">{covers.join(' · ')}</p>
						)}
					</div>
				</div>

				<div className="flex gap-2.5 sm:w-80 sm:shrink-0">
					<motion.button
						type="button"
						onClick={download}
						disabled={working}
						whileTap={{ scale: 0.97 }}
						transition={SPRING}
						className={cn(
							primaryCta,
							saved && 'bg-success text-success-foreground shadow-success/25 hover:bg-success',
							failed && 'bg-destructive/10 text-destructive shadow-none',
						)}
					>
						<Icon className={cn('size-5', working && 'animate-spin')} aria-hidden="true" />
						{saved ? 'Saved' : failed ? 'Try again' : 'Download PDF'}
					</motion.button>
					{canShare && (
						<motion.button
							type="button"
							whileTap={{ scale: 0.94 }}
							onClick={share}
							disabled={!pdf}
							aria-label="Share profit report PDF"
							aria-busy={shareStatus === 'sharing'}
							className={cn(backButton, shareStatus === 'sharing' && 'opacity-60')}
						>
							<Share2Icon className="size-5" aria-hidden="true" />
						</motion.button>
					)}
				</div>
			</div>

			<span role="status" aria-live="polite" className="sr-only">
				{saved ? 'Report saved to your downloads.' : failed ? 'The report could not be built.' : ''}
			</span>

			{shareStatus === 'fellBack' && (
				<p role="status" className="mt-3 text-center text-xs text-muted-foreground sm:text-right">
					Sharing isn't available in this browser, so the PDF was downloaded instead.
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
		const date = parseIsoDate(iso);
		if (!date) return '';
		return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
	};
	const from = stamp(payment_window_start);
	const to = stamp(payment_window_end);
	if (!from || !to) return 'meesho-profit-overview.pdf';
	return `meesho-profit-${from}-to-${to}.pdf`;
}
