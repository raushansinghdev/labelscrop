import { FileSpreadsheetIcon, LockIcon, PlusIcon, UploadIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { cn } from 'cn';

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xlsm', '.xls'];

export interface PaymentFile {
	id: string;
	file: File;
}

function isSpreadsheet(file: File): boolean {
	const name = file.name.toLowerCase();
	return SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface PaymentFileDropzoneProps {
	files: PaymentFile[];
	onFilesAdded: (files: File[]) => void;
	onRemove: (id: string) => void;
	disabled?: boolean;
}

export function PaymentFileDropzone({ files, onFilesAdded, onRemove, disabled }: PaymentFileDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [rejected, setRejected] = useState<string | null>(null);
	const hasFiles = files.length > 0;

	function handleFileList(list: FileList | null) {
		if (!list || list.length === 0) return;
		const incoming = Array.from(list);
		const sheets = incoming.filter(isSpreadsheet);
		const skipped = incoming.length - sheets.length;

		// Re-picking a file already in the list would double its orders, so matching
		// name-and-size pairs are dropped rather than added twice.
		const seen = new Set(files.map((f) => `${f.file.name}:${f.file.size}`));
		const fresh = sheets.filter((f) => !seen.has(`${f.name}:${f.size}`));
		const duplicates = sheets.length - fresh.length;

		const problems = [
			skipped > 0 && `${skipped} file${skipped === 1 ? '' : 's'} skipped — only .xlsx payment files work here.`,
			duplicates > 0 && `${duplicates} file${duplicates === 1 ? ' is' : 's are'} already in the list.`,
		].filter(Boolean);
		setRejected(problems.length > 0 ? problems.join(' ') : null);

		if (fresh.length > 0) onFilesAdded(fresh);
	}

	return (
		<div className="space-y-2">
			<motion.button
				type="button"
				onClick={() => !disabled && inputRef.current?.click()}
				onDragOver={(e) => {
					e.preventDefault();
					if (!disabled) setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					if (!disabled) handleFileList(e.dataTransfer.files);
				}}
				disabled={disabled}
				// Collapses to a slim "add another" row once files are in, so the list and the
				// calculate button stay on one phone screen.
				layout
				whileTap={{ scale: 0.985 }}
				animate={{ scale: dragging ? 1.02 : 1 }}
				transition={{ duration: 0.25, ease: EASE_OUT }}
				className={cn(
					'group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-center transition-colors duration-200',
					hasFiles ? 'gap-0 px-4 py-3.5' : 'gap-3 px-5 py-8 sm:py-10',
					dragging
						? 'border-primary bg-primary/[0.06]'
						: 'border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/[0.03]',
					disabled && 'pointer-events-none opacity-60',
				)}
			>
				{hasFiles ? (
					<motion.span layout="position" className="flex items-center gap-2 text-sm font-semibold text-primary">
						<PlusIcon className="size-4" />
						Add another payment file
					</motion.span>
				) : (
					<>
						<motion.span
							layout="position"
							animate={dragging ? { y: -6, scale: 1.08 } : { y: [0, -5, 0] }}
							transition={dragging ? { duration: 0.2 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
							className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
						>
							<UploadIcon className="size-5" strokeWidth={2.25} />
						</motion.span>
						<motion.span layout="position" className="space-y-1">
							<span className="block text-base font-semibold tracking-tight">
								<span className="sm:hidden">Tap to choose your payment files</span>
								<span className="hidden sm:inline">
									{dragging ? 'Drop to add' : 'Drop your Meesho payment files here'}
								</span>
							</span>
							<span className="block text-xs text-muted-foreground sm:text-sm">
								<span className="hidden sm:inline">or click to browse · </span>
								The <span className="font-medium text-foreground">*_PAYMENT_FILE_*.xlsx</span> from your
								supplier panel
							</span>
						</motion.span>
						<motion.span
							layout="position"
							className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border"
						>
							<LockIcon className="size-3" />
							Stays on your device — nothing is uploaded
						</motion.span>
					</>
				)}
			</motion.button>

			<input
				ref={inputRef}
				type="file"
				accept=".xlsx,.xlsm,.xls"
				multiple
				className="sr-only"
				tabIndex={-1}
				disabled={disabled}
				onChange={(e) => {
					handleFileList(e.target.files);
					e.target.value = '';
				}}
			/>

			<AnimatePresence>
				{rejected && (
					<motion.p
						role="alert"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="text-sm text-destructive"
					>
						{rejected}
					</motion.p>
				)}
			</AnimatePresence>

			<ul className="space-y-2">
				<AnimatePresence initial={false}>
					{files.map((entry, index) => (
						<motion.li
							key={entry.id}
							layout
							initial={{ opacity: 0, y: 12, scale: 0.97 }}
							animate={{
								opacity: 1,
								y: 0,
								scale: 1,
								transition: { duration: 0.35, ease: EASE_OUT, delay: Math.min(index, 6) * 0.04 },
							}}
							exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
							className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 pl-2.5 shadow-xs"
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
								<FileSpreadsheetIcon className="size-5" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium">{entry.file.name}</span>
								<span className="block text-xs text-muted-foreground">{formatSize(entry.file.size)}</span>
							</span>
							<button
								type="button"
								onClick={() => onRemove(entry.id)}
								disabled={disabled}
								aria-label={`Remove ${entry.file.name}`}
								className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted disabled:pointer-events-none disabled:opacity-50"
							>
								<XIcon className="size-4" />
							</button>
						</motion.li>
					))}
				</AnimatePresence>
			</ul>

			{files.length > 1 && (
				<p className="text-center text-xs text-muted-foreground">
					All {files.length} files are combined into one P&amp;L. An order paid across two cycles is counted once.
				</p>
			)}
		</div>
	);
}
