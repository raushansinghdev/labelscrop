import { RefreshCwIcon } from 'lucide-react';
import { Component, type ReactNode } from 'react';

interface Props {
	children: ReactNode;
}

interface State {
	failed: boolean;
}

/**
 * Keeps a failed chart load from taking the whole tool with it.
 *
 * The charts arrive in a lazy chunk, and `Suspense` only covers the *waiting* — if the request
 * fails, the error propagates up and React unmounts the island. That was observed: a dropped
 * chunk request left the seller staring at an empty page with their costs, expenses and parsed
 * file gone, several minutes of work for a flaky network.
 *
 * Nothing here can recover the chunk, but everything around it survives: the profit figures, the
 * product table and the cost editor are plain React and never needed the chart chunk. The charts are the
 * one genuinely optional thing on the page, so they're the one thing allowed to be missing.
 */
export class ChartsBoundary extends Component<Props, State> {
	state: State = { failed: false };

	static getDerivedStateFromError(): State {
		return { failed: true };
	}

	render() {
		if (!this.state.failed) return this.props.children;

		return (
			<section className="rounded-2xl border border-border bg-card p-6 text-center">
				<p className="text-sm font-medium">The charts didn't load</p>
				<p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
					Your profit figures above are complete and correct — only the drawings are missing.
					This is usually a dropped connection.
				</p>
				<button
					type="button"
					// A full reload rather than a retry: the failed chunk is cached as failed by the
					// browser, so re-rendering would fail the same way. Costs and expenses are in
					// localStorage and survive; the payment file has to be picked again, which is
					// why this is a button the seller chooses rather than something automatic.
					onClick={() => window.location.reload()}
					className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<RefreshCwIcon className="size-3.5" aria-hidden="true" />
					Reload the page
				</button>
			</section>
		);
	}
}
