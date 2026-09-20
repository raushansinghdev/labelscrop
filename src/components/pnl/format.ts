/** Indian-format currency and number helpers shared across the profit calculator UI. */

const inr = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat('en-IN');

/** Rounded to the rupee — for headline figures where paise are noise. */
export function formatCurrency(value: number): string {
	return inr.format(value ?? 0);
}

/** Two decimals — for tables that need to reconcile against the source file. */
export function formatCurrencyExact(value: number): string {
	return inrPrecise.format(value ?? 0);
}

export function formatNumber(value: number): string {
	return plain.format(value ?? 0);
}

/** Margin can legitimately be null (no settlement to divide by); that is not 0%. */
export function formatPercent(value: number | null): string {
	if (value === null || value === undefined || Number.isNaN(value)) return '—';
	return `${value.toFixed(1)}%`;
}

/** "1 Aug – 31 Aug 2026" from the calculator's ISO date strings. */
export function formatDateRange(start: string, end: string): string {
	if (!start || !end) return '';
	const fmt = (iso: string) =>
		new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	return `${fmt(start)} – ${fmt(end)}`;
}
