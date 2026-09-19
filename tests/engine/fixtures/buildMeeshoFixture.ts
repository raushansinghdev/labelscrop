import { type PDFFont, PDFDocument, StandardFonts } from 'pdf-lib';

// Mirrors the real Meesho/Delhivery label template's field positions (confirmed against a real 59-page
// export during development — see the project plan) without containing any real customer data. Used to
// build test fixtures that exercise the exact same anchor-matching and column-position logic the real
// engine relies on.

export interface FixtureOrder {
	sku: string;
	size?: string;
	qty?: number;
	color?: string;
	/** e.g. "111111111111111111_1" */
	orderNo: string;
	/** Defaults to the numeric prefix of `orderNo` (before the "_N" suffix), matching real-world behavior. */
	purchaseOrderNo?: string;
	awb: string;
	courier?: string;
	paymentMode?: 'COD' | 'Prepaid';
	destinationCode?: string;
	/** Simulates a destination code that wraps across multiple lines, as the real template does for long
	 * codes — pass the individual wrapped text runs instead of `destinationCode`. */
	destinationCodeLines?: string[];
	destinationState?: string;
	/** Omit the "TAX INVOICE" heading entirely, to exercise the "unrecognized template" fallback path. */
	omitBoundaryAnchor?: boolean;
	/** Omit the Product Details table, to exercise missing-metadata fallback behavior. */
	omitProductTable?: boolean;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_X = 19;
const RIGHT_X = 265;

async function addOrderPage(doc: PDFDocument, font: PDFFont, order: FixtureOrder): Promise<void> {
	const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	const draw = (text: string, x: number, y: number, size = 9) => {
		page.drawText(text, { x, y, size, font });
	};

	draw('Customer Address', LEFT_X, 812);
	draw('Test Customer', LEFT_X, 795);
	draw('123 Fake Street', LEFT_X, 778);
	draw('Test City, Test State, 123456', LEFT_X, 762);
	draw('If undelivered, return to:', LEFT_X, 718);
	draw('Seller Returns Dept', LEFT_X, 702);
	draw('Fallback Return Address Line', LEFT_X, 620);

	draw(`${order.paymentMode ?? 'COD'}: Check the payable amount on the app`, RIGHT_X - 4, 811);
	draw(order.courier ?? 'TestCourier', RIGHT_X, 768);
	draw('Pickup', RIGHT_X + 4, 744);
	draw('Destination Code', RIGHT_X, 721);
	if (order.destinationCodeLines) {
		let y = 706;
		for (const line of order.destinationCodeLines) {
			draw(line, RIGHT_X, y);
			y -= 15;
		}
		draw(`(${order.destinationState ?? 'Test State'})`, RIGHT_X, y);
	} else {
		draw(order.destinationCode ?? 'TestHub_L', RIGHT_X, 706);
		draw(`(${order.destinationState ?? 'Test State'})`, RIGHT_X, 691);
	}
	draw('Return Code', RIGHT_X, 672);
	draw('000000,0000000', RIGHT_X, 657);
	draw(order.awb, RIGHT_X + 88, 617);

	if (!order.omitProductTable) {
		draw('Product Details', LEFT_X, 536);
		draw('SKU', LEFT_X, 517.4);
		draw('Size', 203, 517.4);
		draw('Qty', 297.5, 517.4);
		draw('Color', 344.8, 517.4);
		draw('Order No.', 439.3, 517.4);

		draw(order.sku, LEFT_X, 500.9);
		draw(order.size ?? 'Free Size', 203, 500.9);
		draw(String(order.qty ?? 1), 297.5, 500.9);
		draw(order.color ?? 'Yellow', 344.8, 500.9);
		draw(order.orderNo, 439.3, 500.9);
	}

	if (!order.omitBoundaryAnchor) {
		draw('TAX INVOICE', RIGHT_X, 481.5);
		draw('Original For Recipient', 495, 482.1);
	}

	draw('BILL TO / SHIP TO', 18, 460.6);
	draw('Sold by : TEST SELLER', 227.7, 462.6);
	draw('Purchase Order No.', 227.7, 419.7);
	draw('Invoice No.', 355.4, 419.7);
	draw('Order Date', 440.5, 419.7);
	draw('Invoice Date', 507.4, 419.7);

	const purchaseOrderNo = order.purchaseOrderNo ?? order.orderNo.split('_')[0];
	draw(purchaseOrderNo, 227.7, 407.7);
	draw('inv0001', 355.4, 407.7);
	draw('01.01.2026', 440.5, 407.7);
	draw('02.01.2026', 507.4, 407.7);
}

export async function buildMeeshoFixturePdf(orders: FixtureOrder[]): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (const order of orders) {
		await addOrderPage(doc, font, order);
	}
	return doc.save();
}
