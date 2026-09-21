import type { ProcessOptions } from '@/lib/engine/pipeline';
import type { OverlayOptions, SortDirection, SortKey } from '@/lib/engine/types';
import type { OptionConfig } from '@/lib/options/schema';
import { MEESHO_INVOICE_LAYOUT, MEESHO_LAYOUTS } from './layouts';

const KNOWN_SORT_KEYS: SortKey[] = ['original', 'sku', 'courier', 'destinationCode', 'colorSize', 'sizeColor'];

/** Maps the generic `OptionConfig` produced by `<OptionsForm />` (plain string/boolean values keyed by
 * option id) onto the typed `ProcessOptions` the engine actually wants. This is the one place that knows
 * both the Meesho option ids (from `options.ts`) and the Meesho layout presets (from `layouts.ts`) — the
 * engine and the options-form renderer stay ignorant of each other. */
export function resolveMeeshoProcessOptions(config: OptionConfig): Omit<ProcessOptions, 'onProgress'> {
	const printerType = config.printerType;
	const labelSize = typeof config.labelSize === 'string' ? config.labelSize : 'thermal-4x6';
	const perSheet = config.labelsPerSheet === '1' || config.labelsPerSheet === '2' ? config.labelsPerSheet : '4';
	const layout =
		printerType === 'a4' ? MEESHO_LAYOUTS[`a4-${perSheet}up`] : (MEESHO_LAYOUTS[labelSize] ?? MEESHO_LAYOUTS['thermal-4x6']);

	const cropMode: 'label' | 'full' = config.cropMode === 'full' ? 'full' : 'label';
	// A kept-full page already contains the invoice, so a separate invoice download would be redundant —
	// `options.ts` also hides the "keep invoice" toggle in this mode via `visibleIf`, this just mirrors that
	// at the resolution layer in case a stale/invalid saved config still has it set to "yes".
	const keepInvoice = cropMode === 'label' && config.keepInvoice === true;

	const sortKeyValue = typeof config.sortKey === 'string' ? config.sortKey : 'original';
	const sortKey: SortKey = (KNOWN_SORT_KEYS as string[]).includes(sortKeyValue) ? (sortKeyValue as SortKey) : 'original';

	const sortDirection: SortDirection = config.sortDirection === 'desc' ? 'desc' : 'asc';

	const customText = typeof config.customText === 'string' ? config.customText.trim() : '';
	const overlay: OverlayOptions = {
		customText: customText.length > 0 ? customText : undefined,
		showOrderNumber: config.showOrderNumber === true,
		showDateTime: config.showDateTime === true,
		showQtyBadge: config.multiUnitFirst === true,
	};

	return {
		layout,
		sortKey,
		sortDirection,
		cropMode,
		keepInvoice,
		invoiceLayout: keepInvoice ? MEESHO_INVOICE_LAYOUT : undefined,
		overlay,
		multiUnitFirst: config.multiUnitFirst === true,
		skipDuplicates: config.skipDuplicates === true,
		splitByCourier: config.splitByCourier === true,
	};
}
