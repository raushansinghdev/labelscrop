import { useCallback, useEffect, useRef, useState } from 'react';

export function triggerDownload(url: string, filename: string) {
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

type ShareStatus = 'idle' | 'sharing' | 'fellBack';

/** Web Share with files — on phones this hands the PDF straight to WhatsApp, Drive, or a printer app, which
 * is usually where a seller's labels are headed anyway. Only offered where the browser can share files at
 * all (most mobile browsers; hidden on desktop browsers that can't).
 *
 * Two things make a naive `navigator.share()` flaky on real phones:
 *  - A tap while a sheet is still open rejects with InvalidStateError, and on some Android builds a sheet
 *    dismissed with the back gesture never settles its promise — the browser then refuses every later share.
 *    So re-entry is guarded, and the guard is released when the page becomes visible again (the sheet is
 *    gone) or after a timeout, so it can never wedge the button for the session.
 *  - `canShare` only says the browser knows how to share files. In in-app browsers (Instagram, WhatsApp,
 *    Facebook) or a frame without the `web-share` permission it still says yes, and `share()` then rejects
 *    with NotAllowedError. So any failure other than the user cancelling falls back to the download. */
export function useShareFile(pdf: { blob: Blob; url: string } | null, filename: string) {
	const [canShare, setCanShare] = useState(false);
	const [status, setStatus] = useState<ShareStatus>('idle');
	const inFlight = useRef(false);

	useEffect(() => {
		try {
			const probe = new File([new Uint8Array(1)], 'probe.pdf', { type: 'application/pdf' });
			setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
		} catch {
			setCanShare(false);
		}
	}, []);

	useEffect(() => {
		if (status === 'fellBack') {
			const timer = window.setTimeout(() => setStatus('idle'), 6000);
			return () => window.clearTimeout(timer);
		}
		if (status !== 'sharing') return;
		const release = () => {
			inFlight.current = false;
			setStatus((s) => (s === 'sharing' ? 'idle' : s));
		};
		const timer = window.setTimeout(release, 30_000);
		const onVisible = () => {
			if (document.visibilityState === 'visible') window.setTimeout(release, 500);
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [status]);

	const share = useCallback(() => {
		if (inFlight.current || !pdf) return;
		const fallBack = () => {
			triggerDownload(pdf.url, filename);
			setStatus('fellBack');
		};
		const file = new File([pdf.blob], filename, { type: 'application/pdf' });
		// Ask again with the real file: the mount-time probe only proves the browser can share *a* PDF.
		if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) {
			fallBack();
			return;
		}
		inFlight.current = true;
		setStatus('sharing');
		// Files only — with `title`/`text` alongside, some targets (WhatsApp, Gmail) send the text and drop the PDF.
		navigator
			.share({ files: [file] })
			.then(() => setStatus('idle'))
			.catch((err: unknown) => {
				// AbortError is the user closing the sheet — nothing failed, so nothing to say.
				if (err instanceof Error && err.name === 'AbortError') setStatus('idle');
				else fallBack();
			})
			.finally(() => {
				inFlight.current = false;
			});
	}, [pdf, filename]);

	return { canShare, status, share };
}

