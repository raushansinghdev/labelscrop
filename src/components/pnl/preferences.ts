import { DEFAULT_EXPENSES, type ExpenseRow } from './expenses';
import type { LossRates } from './types';

/** What the tool assumes until a seller says otherwise: every returned item is written off. */
export const DEFAULT_LOSS_RATES: LossRates = {
	rto: 0,
	return_rate: 1,
	lost: 1,
	unresolved: 0,
	rto_packaging_loss: 1,
	return_packaging_loss: 1,
};

const LOSS_RATES_KEY = 'meesho_loss_rates';
const EXPENSES_KEY = 'meesho_expenses';

/**
 * Everything the seller teaches this tool lives in their own browser — SKU costs in
 * `skuCosts.js`, loss rates here. Nothing is uploaded, which is the whole promise of the tool,
 * and the cost of that promise is that the browser is also the only copy.
 */
export function loadLossRates(fallback: LossRates): LossRates {
	try {
		const raw = localStorage.getItem(LOSS_RATES_KEY);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw) as Partial<Record<keyof LossRates, unknown>>;

		// Merged onto the defaults key by key rather than trusted wholesale: a rate saved by an
		// older version may be missing keys this one needs, and a bad number would otherwise
		// propagate silently into the profit figure.
		const next = { ...fallback };
		for (const key of Object.keys(fallback) as (keyof LossRates)[]) {
			const value = Number(parsed[key]);
			if (Number.isFinite(value) && value >= 0 && value <= 1) next[key] = value;
		}
		return next;
	} catch {
		return fallback;
	}
}

export function saveLossRates(rates: LossRates): void {
	try {
		localStorage.setItem(LOSS_RATES_KEY, JSON.stringify(rates));
	} catch {
		// Private windows and full quotas both throw here. Losing the preference is survivable;
		// breaking the recalculation the seller just asked for is not.
	}
}

/**
 * Business expenses are recurring, so they outlive any one payment file — a seller who set rent
 * last month should find it waiting next month.
 */
export function loadExpenses(): ExpenseRow[] {
	try {
		const raw = localStorage.getItem(EXPENSES_KEY);
		if (!raw) return DEFAULT_EXPENSES;
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return DEFAULT_EXPENSES;

		const rows: ExpenseRow[] = [];
		for (const entry of parsed) {
			if (!entry || typeof entry !== 'object') continue;
			const { id, label, monthly } = entry as Record<string, unknown>;
			const amount = Number(monthly);
			// A row with a bad amount keeps its label and loses its number, rather than taking
			// the whole list down with it and wiping every expense the seller entered.
			if (typeof id !== 'string' || typeof label !== 'string') continue;
			rows.push({ id, label, monthly: Number.isFinite(amount) && amount >= 0 ? amount : 0 });
		}
		return rows.length > 0 ? rows : DEFAULT_EXPENSES;
	} catch {
		return DEFAULT_EXPENSES;
	}
}

export function saveExpenses(rows: ExpenseRow[]): void {
	try {
		localStorage.setItem(EXPENSES_KEY, JSON.stringify(rows));
	} catch {
		// Same reasoning as the loss rates above.
	}
}

/**
 * Asks the browser not to evict this origin's storage when it runs short of space.
 *
 * Without it, localStorage is "best effort" — eligible for clearing under storage pressure. With
 * it granted, the data survives until the seller clears it themselves. Chrome and Firefox decide
 * from engagement signals (Firefox prompts); Safari does not implement it at all, and expires
 * script-written storage after seven days without a visit regardless. So this raises the ceiling
 * where it can and the spreadsheet backup remains the only guarantee.
 */
export async function requestPersistentStorage(): Promise<boolean> {
	try {
		if (!navigator.storage?.persist) return false;
		if (await navigator.storage.persisted()) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}
