import { FileTextIcon, LockIcon, PlusIcon, UploadIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { cn } from 'cn';

export interface UploadedFile {
	id: string;
	name: string;
	sizeBytes: number;
	bytes: Uint8Array;
}

interface UploadDropzoneProps {
	files: UploadedFile[];
	onFilesAdded: (files: { name: string; bytes: Uint8Array }[]) => void;
	onRemove: (id: string) => void;
	disabled?: boolean;
}

function isPdf(file: File): boolean {
	return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function formatSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function UploadDropzone({ files, onFilesAdded, onRemove, disabled }: UploadDropzoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [rejectionError, setRejectionError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const hasFiles = files.length > 0;

	async function handleFileList(fileList: FileList | null) {
		if (!fileList || fileList.length === 0) return;
		const incoming = Array.from(fileList);
		const pdfs = incoming.filter(isPdf);
		const rejected = incoming.length - pdfs.length;
		setRejectionError(rejected > 0 ? `${rejected} file${rejected === 1 ? '' : 's'} skipped — only PDF files are supported.` : null);
		if (pdfs.length === 0) return;

		const loaded = await Promise.all(
			pdfs.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })),
		);
		onFilesAdded(loaded);
	}

	const openPicker = () => {
		if (!disabled) inputRef.current?.click();
	};

	return (
		<div className="space-y-3">
			<motion.button
				type="button"
				onClick={openPicker}
				onDragOver={(e) => {
					e.preventDefault();
					if (!disabled) setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setIsDragging(false);
					if (!disabled) void handleFileList(e.dataTransfer.files);
				}}
				disabled={disabled}
				// Collapses to a slim "add more" row once files are in, so the file list and the Continue bar
				// stay within one phone screen instead of sitting below a full-height drop target.
				layout
				whileTap={{ scale: 0.985 }}
				animate={{ scale: isDragging ? 1.02 : 1 }}
				transition={{ duration: 0.25, ease: EASE_OUT }}
				className={cn(
					'group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed text-center transition-colors duration-200',
					hasFiles ? 'gap-0 px-4 py-4' : 'gap-4 px-6 py-12 sm:py-16',
					isDragging
						? 'border-primary bg-primary/[0.06]'
						: 'border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/[0.03]',
					disabled && 'pointer-events-none opacity-60',
				)}
			>
				{hasFiles ? (
					<motion.span layout="position" className="flex items-center gap-2 text-sm font-semibold text-primary">
						<PlusIcon className="size-4" />
						Add more PDFs
					</motion.span>
				) : (
					<>
						<motion.span
							layout="position"
							animate={isDragging ? { y: -6, scale: 1.08 } : { y: [0, -5, 0] }}
							transition={isDragging ? { duration: 0.2 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
							className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
						>
							<UploadIcon className="size-7" strokeWidth={2.25} />
						</motion.span>
						<motion.span layout="position" className="space-y-1.5">
							<span className="block text-lg font-semibold tracking-tight">
								<span className="sm:hidden">Tap to choose your label PDFs</span>
								<span className="hidden sm:inline">{isDragging ? 'Drop to add' : 'Drop your label PDFs here'}</span>
							</span>
							<span className="block text-sm text-muted-foreground">
								<span className="hidden sm:inline">or click to browse · </span>Add as many files as you like
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
				accept="application/pdf,.pdf"
				multiple
				aria-label="Choose label PDFs"
				className="sr-only"
				tabIndex={-1}
				onChange={(e) => {
					void handleFileList(e.target.files);
					e.target.value = '';
				}}
			/>

			<AnimatePresence>
				{rejectionError && (
					<motion.p
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="text-sm text-destructive"
					>
						{rejectionError}
					</motion.p>
				)}
			</AnimatePresence>

			<ul className="space-y-2">
				<AnimatePresence initial={false}>
					{files.map((file, index) => (
						<motion.li
							key={file.id}
							layout
							initial={{ opacity: 0, y: 12, scale: 0.97 }}
							animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: EASE_OUT, delay: Math.min(index, 6) * 0.04 } }}
							exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
							className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pl-3 shadow-xs"
						>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
								<FileTextIcon className="size-5" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium">{file.name}</span>
								<span className="block text-xs text-muted-foreground">{formatSize(file.sizeBytes)}</span>
							</span>
							<button
								type="button"
								onClick={() => onRemove(file.id)}
								disabled={disabled}
								aria-label={`Remove ${file.name}`}
								className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted disabled:pointer-events-none disabled:opacity-50"
							>
								<XIcon className="size-4" />
							</button>
						</motion.li>
					))}
				</AnimatePresence>
			</ul>
		</div>
	);
}
