/**
 * Fixed business expenses — salary, rent, bills — and how much of one belongs to a payment file.
 *
 * These are deliberately separate from the loss rates. A loss rate says how much of an *item* is
 * written off when it comes back, so it changes cost of goods and therefore per-SKU profit. Rent
 * is caused by no order in particular: it comes off the bottom line once and is never divided
 * between products, because any split would be an invention.
 */

export interface ExpenseRow {
	id: string;
	label: string;
	/** What the seller pays per month. Kept monthly because that's how rent and salary are known. */
	monthly: number;
}

/** The four a Meesho seller almost always has. Start at zero so nothing is assumed on their behalf. */
export const DEFAULT_EXPENSES: ExpenseRow[] = [
	{ id: 'salary', label: 'Salary & wages', monthly: 0 },
	{ id: 'rent', label: 'Rent', monthly: 0 },
	{ id: 'bills', label: 'Bills & subscriptions', monthly: 0 },
	{ id: 'other', label: 'Other', monthly: 0 },
];

/**
 * A month, for proration. Payment windows are 28–31 days and rarely line up with a calendar
 * month, so a fixed 30 keeps the arithmetic one the seller can check in their head — and the UI
 * shows the working rather than asking them to trust it.
 */
export const DAYS_IN_MONTH = 30;

/**
 * Days covered by the payment window, inclusive of both ends.
 *
 * Returns `DAYS_IN_MONTH` when the dates are missing or unparseable: a file we can't date should
 * charge a normal month of expenses rather than silently charging nothing, which would overstate
 * profit — the exact failure this whole step exists to prevent.
 */
export function windowDays(start: string | null | undefined, end: string | null | undefined): number {
	if (!start || !end) return DAYS_IN_MONTH;
	const from = Date.parse(start);
	const to = Date.parse(end);
	if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return DAYS_IN_MONTH;
	return Math.round((to - from) / 86_400_000) + 1;
}

/** The share of one monthly amount that belongs to a window of `days`. */
export function prorate(monthly: number, days: number): number {
	if (!Number.isFinite(monthly) || monthly <= 0) return 0;
	return (monthly * days) / DAYS_IN_MONTH;
}

/** Everything the seller pays monthly, charged to this file's window. */
export function totalProrated(rows: ExpenseRow[], days: number): number {
	return rows.reduce((sum, row) => sum + prorate(row.monthly, days), 0);
}
