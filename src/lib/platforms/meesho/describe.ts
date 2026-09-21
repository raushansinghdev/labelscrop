import type { OptionConfig } from '@/lib/options/schema';
import { MEESHO_OPTIONS } from './options';

function choiceLabel(fieldId: string, value: string | boolean | undefined): string | null {
	const field = MEESHO_OPTIONS.find((f) => f.id === fieldId);
	return field?.choices?.find((choice) => choice.value === value)?.label ?? null;
}

/** A few short, human phrases describing what the current settings will produce — shown as chips under the
 * preview and as the subtitle on the results screen, so the seller can confirm "A4 · 4 per sheet · Label
 * only" at a glance without re-reading the whole form. */
export function describeMeeshoConfig(config: OptionConfig): string[] {
	const parts: string[] = [];
	if (config.printerType === 'a4') {
		const perSheet = typeof config.labelsPerSheet === 'string' ? config.labelsPerSheet : '4';
		parts.push(`A4 · ${perSheet} per sheet`);
	} else {
		const size = choiceLabel('labelSize', config.labelSize);
		parts.push(size ? `${size} label` : 'Label printer');
	}
	parts.push(config.cropMode === 'full' ? 'Label + invoice' : 'Label only');
	if (config.sortKey && config.sortKey !== 'original') {
		const sort = choiceLabel('sortKey', config.sortKey);
		// Lower-case the first letter of ordinary words ("Courier" → "courier") but leave acronyms ("SKU") alone.
		if (sort) {
			const name = /^[A-Z][a-z]/.test(sort) ? sort.charAt(0).toLowerCase() + sort.slice(1) : sort;
			parts.push(`Sorted by ${name}${config.sortDirection === 'desc' ? ', Z–A' : ''}`);
		}
	}
	if (config.multiUnitFirst === true) parts.push('Multi-unit first');
	if (config.splitByCourier === true) parts.push('Split by courier');
	return parts;
}
