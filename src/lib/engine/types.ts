/** A single positioned text run extracted from a PDF page (PDF user-space coordinates, origin bottom-left). */
export interface TextItem {
	text: string;
	x: number;
	y: number;
}

/** Text items grouped into one visual line, left-to-right, with a combined, whitespace-normalized string. */
export interface TextLine {
	y: number;
	text: string;
	items: TextItem[];
}

/** The extracted text model for one page of a source PDF. Meesho (and most Indian courier) labels lay the
 * customer-address block and the courier/AWB block out as two side-by-side columns at the top of the page,
 * so `items` (the raw, ungrouped text runs) is kept alongside `lines` (a best-effort visual line grouping) —
 * metadata extraction that needs to distinguish the two columns works against `items` directly rather than
 * risking the two columns' text getting merged onto one grouped line. */
export interface PageTextModel {
	pageIndex: number;
	/** Page width/height in PDF points, unrotated content space (matches pdf-lib's page coordinate space). */
	width: number;
	height: number;
	/** Raw text runs, reading order (top to bottom, left to right within a row). */
	items: TextItem[];
	lines: TextLine[];
}

/** A bounding box in PDF user-space coordinates, as consumed by pdf-lib's `embedPage`. */
export interface Rect {
	left: number;
	bottom: number;
	right: number;
	top: number;
}

export interface BoundaryResult {
	found: boolean;
	/** y-coordinate (PDF points, origin bottom-left) of the split line between label and invoice regions. */
	splitY: number | null;
}

export type PaymentMode = 'COD' | 'Prepaid';

/** Normalized per-order fields extracted from one label page. All fields are best-effort — a field that
 * couldn't be found is `null` rather than throwing, so a single unusual page never fails the whole batch. */
export interface OrderMetadata {
	sku: string | null;
	size: string | null;
	qty: number | null;
	color: string | null;
	/** The order-item id (e.g. "332416759589154944_1") — carries a `_N` suffix for multi-item orders. */
	orderNo: string | null;
	/** The parent order id shared across an order's sub-orders (e.g. "332416759589154944"). */
	purchaseOrderNo: string | null;
	/** The AWB / courier tracking number printed above the shipping barcode. */
	awb: string | null;
	courier: string | null;
	paymentMode: PaymentMode | null;
	/** The courier's destination/pickup hub code (e.g. "Jaipur_RingRoad_L"), used for pickup-based sorting. */
	destinationCode: string | null;
}

/** One page from an uploaded source file, after boundary detection and metadata extraction, before
 * sorting/composition. Still references its source file/page index rather than any PDF bytes. */
export interface SourcePage {
	fileIndex: number;
	pageIndex: number;
	pageText: PageTextModel;
	boundary: BoundaryResult;
	metadata: OrderMetadata;
}

export type SortKey = 'original' | 'sku' | 'courier' | 'destinationCode' | 'colorSize' | 'sizeColor';

/** An output layout: either one label per page (a thermal printer size) or a grid of labels on a larger sheet. */
export interface LayoutPreset {
	id: string;
	label: string;
	/** Output page size in PDF points. */
	pageWidth: number;
	pageHeight: number;
	columns: number;
	rows: number;
	marginPt: number;
	gapPt: number;
}

export interface OverlayOptions {
	customText?: string;
	showOrderNumber?: boolean;
	showDateTime?: boolean;
}

export interface SkuSummaryRow {
	sku: string;
	count: number;
}

/** The typed contract a marketplace module (Meesho, and later Amazon/Flipkart) must implement to plug into
 * the platform-agnostic engine below. The engine, worker plumbing, and UI options-form renderer are all
 * written once against this interface — adding a new marketplace is just a new module implementing it. */
export interface PlatformAdapter {
	id: string;
	label: string;
	detectBoundary: (page: PageTextModel) => BoundaryResult;
	extractMetadata: (page: PageTextModel, splitY: number | null) => OrderMetadata;
	layouts: Record<string, LayoutPreset>;
}
