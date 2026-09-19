import { FileTextIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';

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

export function UploadDropzone({ files, onFilesAdded, onRemove, disabled }: UploadDropzoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [rejectionError, setRejectionError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

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

	return (
		<div className="space-y-3">
			<motion.div
				onClick={() => {
					if (!disabled) inputRef.current?.click();
				}}
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
				animate={{ scale: isDragging ? 1.015 : 1 }}
				transition={{ duration: 0.15 }}
				className={cn(
					'cursor-pointer rounded-2xl border border-dashed p-8 text-center transition-colors sm:p-10',
					isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5',
					disabled && 'pointer-events-none cursor-default opacity-60',
				)}
			>
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<UploadCloudIcon className="h-7 w-7" />
				</div>
				<p className="mt-4 font-semibold">Click to upload or drag & drop your Meesho label PDF{files.length !== 1 ? 's' : ''}</p>
				<p className="mt-1.5 text-sm text-muted-foreground">PDF files only, nothing ever leaves your device</p>
				<Button
					type="button"
					variant="outline"
					className="mt-4"
					onClick={(e) => {
						e.stopPropagation();
						inputRef.current?.click();
					}}
					disabled={disabled}
				>
					Browse files
				</Button>
				<input
					ref={inputRef}
					type="file"
					accept="application/pdf,.pdf"
					multiple
					className="sr-only"
					onChange={(e) => {
						void handleFileList(e.target.files);
						e.target.value = '';
					}}
				/>
			</motion.div>

			{rejectionError && <p className="text-sm text-destructive">{rejectionError}</p>}

			{files.length > 0 && (
				<ul className="space-y-1.5">
					<AnimatePresence initial={false}>
						{files.map((file) => (
							<motion.li
								key={file.id}
								layout
								initial={{ opacity: 0, height: 0, y: -4 }}
								animate={{ opacity: 1, height: 'auto', y: 0 }}
								exit={{ opacity: 0, height: 0, y: -4 }}
								transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
								className="flex items-center justify-between gap-3 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 text-sm"
							>
								<span className="flex min-w-0 items-center gap-2">
									<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
									<span className="truncate font-medium">{file.name}</span>
									<span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.sizeBytes)}</span>
								</span>
								<button
									type="button"
									onClick={() => onRemove(file.id)}
									disabled={disabled}
									aria-label={`Remove ${file.name}`}
									className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
								>
									<XIcon className="size-4" />
								</button>
							</motion.li>
						))}
					</AnimatePresence>
				</ul>
			)}
		</div>
	);
}
