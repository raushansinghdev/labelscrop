import type { LayoutPreset } from '@/lib/engine/types';

const PT_PER_INCH = 72;
const inch = (n: number) => n * PT_PER_INCH;

/** Label-output layout presets. Thermal presets are a single full-bleed cell (one label per page); the A4
 * preset packs a grid of cells with a small margin/gap so a home/office printer can cut them apart. */
export const MEESHO_LAYOUTS: Record<string, LayoutPreset> = {
	'thermal-3x5': {
		id: 'thermal-3x5',
		label: '3 x 5" label printer',
		pageWidth: inch(3),
		pageHeight: inch(5),
		columns: 1,
		rows: 1,
		marginPt: 0,
		gapPt: 0,
	},
	'thermal-4x6': {
		id: 'thermal-4x6',
		label: '4 x 6" label printer',
		pageWidth: inch(4),
		pageHeight: inch(6),
		columns: 1,
		rows: 1,
		marginPt: 0,
		gapPt: 0,
	},
	'a4-4up': {
		id: 'a4-4up',
		label: 'A4 sheet, 4 labels per page',
		pageWidth: inch(8.27),
		pageHeight: inch(11.69),
		columns: 2,
		rows: 2,
		marginPt: inch(0.25),
		gapPt: inch(0.15),
	},
};

/** Layout used when the user asks to keep the tax invoice as its own separate PDF — one full invoice per
 * A4 page, matching how Meesho renders the invoice section itself. */
export const MEESHO_INVOICE_LAYOUT: LayoutPreset = {
	id: 'a4-invoice',
	label: 'A4 invoice sheet',
	pageWidth: inch(8.27),
	pageHeight: inch(11.69),
	columns: 1,
	rows: 1,
	marginPt: inch(0.2),
	gapPt: 0,
};
