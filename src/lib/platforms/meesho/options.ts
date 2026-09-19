import type { OptionField } from '@/lib/options/schema';

/** Placeholder option list, based on the competitor research in the project plan (GST ProSeller, SellerBox,
 * Listify, MagicalToolz) — swap in the user's finalized list here. Because the UI renders off this
 * declarative array (see `src/lib/options/schema.ts`), editing this file is the *only* change needed to add,
 * remove, or reorder options; no component rework required. */
export const MEESHO_OPTIONS: OptionField[] = [
	{
		id: 'printerType',
		label: 'Printer Type',
		group: 'Printer',
		controlType: 'segmented',
		choices: [
			{ value: 'label', label: 'Label Printer' },
			{ value: 'a4', label: 'A4 Printer' },
		],
		default: 'label',
		simpleModeVisible: true,
	},
	{
		id: 'labelSize',
		label: 'Label Size',
		group: 'Printer',
		controlType: 'segmented',
		choices: [
			{ value: 'thermal-3x5', label: '3x5"' },
			{ value: 'thermal-4x6', label: '4x6"' },
		],
		default: 'thermal-4x6',
		visibleIf: (config) => config.printerType === 'label',
		simpleModeVisible: true,
	},
	{
		id: 'cropMode',
		label: 'Crop Mode',
		group: 'Crop & Invoice',
		controlType: 'segmented',
		choices: [
			{ value: 'label', label: 'Crop invoice away' },
			{ value: 'full', label: 'Keep full page' },
		],
		default: 'label',
		helpText:
			'"Keep full page" leaves the invoice attached and just resizes/sorts the original page — use this if you only want to sort your labels without cropping anything.',
		simpleModeVisible: true,
	},
	{
		id: 'keepInvoice',
		label: 'Also Save Invoices Separately',
		group: 'Crop & Invoice',
		controlType: 'segmented',
		choices: [
			{ value: 'no', label: 'No' },
			{ value: 'yes', label: 'Yes' },
		],
		default: 'no',
		helpText: 'When "Yes", the tax invoice is kept as its own separate downloadable PDF.',
		visibleIf: (config) => config.cropMode !== 'full',
		simpleModeVisible: true,
	},
	{
		id: 'sortKey',
		label: 'Sort Labels By',
		group: 'Sorting',
		controlType: 'select',
		choices: [
			{ value: 'original', label: 'Original order' },
			{ value: 'sku', label: 'SKU ID' },
			{ value: 'courier', label: 'Courier' },
			{ value: 'destinationCode', label: 'Pickup hub' },
			{ value: 'colorSize', label: 'Color, then size' },
			{ value: 'sizeColor', label: 'Size, then color' },
		],
		default: 'original',
		simpleModeVisible: true,
	},
	{
		id: 'customText',
		label: 'Custom Text',
		group: 'Stamps',
		controlType: 'text',
		default: '',
		helpText: 'Printed on every label, e.g. a dispatch date or thank-you note.',
		simpleModeVisible: false,
	},
	{
		id: 'showOrderNumber',
		label: 'Order #',
		group: 'Stamps',
		controlType: 'toggle',
		default: false,
		simpleModeVisible: false,
	},
	{
		id: 'showDateTime',
		label: 'Print Date & Time',
		group: 'Stamps',
		controlType: 'toggle',
		default: false,
		simpleModeVisible: false,
	},
];
