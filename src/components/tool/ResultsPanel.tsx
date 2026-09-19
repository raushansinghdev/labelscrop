import { AlertTriangleIcon, CheckCircle2Icon, DownloadIcon, RotateCcwIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { FileFailure, ProcessResult } from '@/lib/engine/pipeline';

interface ResultsPanelProps {
	result: ProcessResult;
	failures: FileFailure[];
	onReset: () => void;
}

function useObjectUrl(bytes: Uint8Array | null): string | null {
	return useMemo(() => {
		if (!bytes) return null;
		return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
	}, [bytes]);
}

// dd-mm-yyyy (not dd/mm/yyyy — "/" isn't valid in a filename) so a seller's downloads folder sorts/groups
// by day across repeated runs, e.g. meesho-label-19-09-2026.pdf.
function dateStamp(): string {
	const now = new Date();
	const dd = String(now.getDate()).padStart(2, '0');
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	return `${dd}-${mm}-${now.getFullYear()}`;
}

function DownloadLink({ href, filename, label }: { href: string | null; filename: string; label: string }) {
	if (!href) return null;
	return (
		<a
			href={href}
			download={filename}
			className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
		>
			<DownloadIcon className="size-4" />
			{label}
		</a>
	);
}

export function ResultsPanel({ result, failures, onReset }: ResultsPanelProps) {
	const labelUrl = useObjectUrl(result.labelPdfBytes);
	const invoiceUrl = useObjectUrl(result.invoicePdfBytes);
	const summaryUrl = useObjectUrl(result.summaryPdfBytes);
	const stamp = useMemo(() => dateStamp(), []);

	useEffect(() => {
		return () => {
			for (const url of [labelUrl, invoiceUrl, summaryUrl]) {
				if (url) URL.revokeObjectURL(url);
			}
		};
	}, [labelUrl, invoiceUrl, summaryUrl]);

	return (
		<div className="space-y-5 rounded-2xl border border-border bg-card p-5">
			<div className="flex items-center gap-2 text-success">
				<motion.span
					initial={{ scale: 0.5, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ type: 'spring', stiffness: 400, damping: 20 }}
					className="flex"
				>
					<CheckCircle2Icon className="size-5" />
				</motion.span>
				<p className="font-semibold text-foreground">
					{result.pageCount} label{result.pageCount === 1 ? '' : 's'} ready
				</p>
			</div>

			<div className="flex flex-wrap gap-3">
				<DownloadLink href={labelUrl} filename={`meesho-label-${stamp}.pdf`} label="Download labels" />
				<DownloadLink href={invoiceUrl} filename={`meesho-invoice-${stamp}.pdf`} label="Download invoices" />
				<DownloadLink href={summaryUrl} filename={`meesho-summary-${stamp}.pdf`} label="Download SKU summary" />
			</div>

			{result.summary.length > 0 && (
				<div>
					<p className="mb-2 text-sm font-semibold">SKU summary</p>
					<div className="max-h-64 overflow-y-auto rounded-lg border border-border">
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
								<tr>
									<th className="px-3 py-2 text-left font-medium">SKU</th>
									<th className="px-3 py-2 text-right font-medium">Qty</th>
								</tr>
							</thead>
							<tbody>
								{result.summary.map((row) => (
									<tr key={row.sku} className="border-t border-border">
										<td className="px-3 py-1.5">{row.sku}</td>
										<td className="px-3 py-1.5 text-right tabular-nums">{row.count}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{(result.warnings.length > 0 || failures.length > 0) && (
				<div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
					{failures.map((failure) => (
						<p key={failure.fileName} className="flex items-start gap-2 text-destructive">
							<AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
							<span>
								<strong>{failure.fileName}</strong> was skipped: {failure.message}
							</span>
						</p>
					))}
					{result.warnings.map((warning) => (
						<p key={warning} className="flex items-start gap-2 text-muted-foreground">
							<AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
							<span>{warning}</span>
						</p>
					))}
				</div>
			)}

			<Button type="button" variant="outline" onClick={onReset}>
				<RotateCcwIcon className="size-4" />
				Start over
			</Button>
		</div>
	);
}
