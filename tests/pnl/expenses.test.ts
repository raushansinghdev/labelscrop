import { describe, expect, it } from 'vitest';
import {
	DAYS_IN_MONTH,
	DEFAULT_EXPENSES,
	prorate,
	totalProrated,
	windowDays,
	type ExpenseRow,
} from '@/components/pnl/expenses';

/**
 * Expenses are subtracted straight from the headline profit, so a wrong proration is invisible:
 * the figure still looks like a figure. These pin the arithmetic the UI shows its working for.
 */
describe('windowDays', () => {
	it('counts both end dates', () => {
		expect(windowDays('2026-08-03', '2026-08-31')).toBe(29);
		expect(windowDays('2026-08-01', '2026-08-01')).toBe(1);
	});

	it('falls back to a full month rather than charging nothing', () => {
		// Charging zero would overstate profit, which is the failure this step exists to prevent.
		expect(windowDays(null, '2026-08-31')).toBe(DAYS_IN_MONTH);
		expect(windowDays('not a date', '2026-08-31')).toBe(DAYS_IN_MONTH);
		expect(windowDays('2026-08-31', '2026-08-03')).toBe(DAYS_IN_MONTH);
	});
});

describe('prorate', () => {
	it('charges the share of a month the window covers', () => {
		expect(prorate(10000, 29)).toBeCloseTo(9666.67, 2);
		expect(prorate(10000, DAYS_IN_MONTH)).toBe(10000);
	});

	it('ignores amounts that are absent or nonsense', () => {
		expect(prorate(0, 29)).toBe(0);
		expect(prorate(-500, 29)).toBe(0);
		expect(prorate(Number.NaN, 29)).toBe(0);
	});

	it('charges more than a month when the window is longer than one', () => {
		// Two payment files merged into a 60-day window should carry two months of rent.
		expect(prorate(10000, 60)).toBe(20000);
	});
});

describe('totalProrated', () => {
	const rows: ExpenseRow[] = [
		{ id: 'salary', label: 'Salary', monthly: 25000 },
		{ id: 'rent', label: 'Rent', monthly: 10000 },
		{ id: 'bills', label: 'Bills', monthly: 2500 },
	];

	it('sums every row against the same window', () => {
		expect(totalProrated(rows, DAYS_IN_MONTH)).toBe(37500);
		expect(totalProrated(rows, 29)).toBeCloseTo(36250, 2);
	});

	it('is zero until the seller enters something', () => {
		// The defaults must not invent an expense on the seller's behalf.
		expect(totalProrated(DEFAULT_EXPENSES, 29)).toBe(0);
		expect(totalProrated([], 29)).toBe(0);
	});
});
