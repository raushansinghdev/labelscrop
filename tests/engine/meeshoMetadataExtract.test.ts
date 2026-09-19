import { describe, expect, it } from 'vitest';
import { extractPageLines } from '@/lib/engine/pdfText';
import { detectMeeshoBoundary } from '@/lib/platforms/meesho/boundaryDetect';
import { extractMeeshoMetadata } from '@/lib/platforms/meesho/metadataExtract';
import { buildMeeshoFixturePdf, type FixtureOrder } from './fixtures/buildMeeshoFixture';

async function extractAll(orders: FixtureOrder[]) {
	const bytes = await buildMeeshoFixturePdf(orders);
	const pages = await extractPageLines(bytes);
	return pages.map((page) => {
		const boundary = detectMeeshoBoundary(page);
		return { boundary, metadata: extractMeeshoMetadata(page, boundary.splitY) };
	});
}

describe('extractMeeshoMetadata', () => {
	it('extracts every field correctly for a normal page', async () => {
		const [{ boundary, metadata }] = await extractAll([
			{
				sku: 'BQ_SF_02',
				size: 'Free Size',
				qty: 1,
				color: 'Yellow',
				orderNo: '332416759589154944_1',
				awb: '1490841336683403',
				courier: 'Delhivery',
				paymentMode: 'COD',
				destinationCode: 'Jaipur_RingRoad_L',
				destinationState: 'Rajasthan',
			},
		]);

		expect(boundary.found).toBe(true);
		expect(metadata).toEqual({
			sku: 'BQ_SF_02',
			size: 'Free Size',
			qty: 1,
			color: 'Yellow',
			orderNo: '332416759589154944_1',
			purchaseOrderNo: '332416759589154944',
			awb: '1490841336683403',
			courier: 'Delhivery',
			paymentMode: 'COD',
			destinationCode: 'Jaipur_RingRoad_L',
		});
	});

	it('reconstructs a destination code that wraps across multiple lines', async () => {
		// Mirrors the real "Naihati_Rajendrapur_DPP" example, which wraps onto its own extra line.
		const [{ metadata }] = await extractAll([
			{
				sku: 'SKU-A',
				orderNo: '200000000000000001_1',
				awb: '9100000000000001',
				destinationCodeLines: ['AVeryLongDestinationHub', 'Code_DPP'],
				destinationState: 'West Bengal',
			},
		]);
		expect(metadata.destinationCode).toBe('AVeryLongDestinationHubCode_DPP');
	});

	it('recognizes Prepaid orders distinctly from COD', async () => {
		const [{ metadata }] = await extractAll([
			{ sku: 'SKU-A', orderNo: '300000000000000001_1', awb: '9200000000000001', paymentMode: 'Prepaid' },
		]);
		expect(metadata.paymentMode).toBe('Prepaid');
	});

	it('distinguishes the AWB from the Purchase Order No. even though both are bare digit runs', async () => {
		const [{ metadata }] = await extractAll([
			{ sku: 'SKU-A', orderNo: '400000000000000001_1', awb: '9300000000000001' },
		]);
		expect(metadata.awb).toBe('9300000000000001');
		expect(metadata.purchaseOrderNo).toBe('400000000000000001');
		expect(metadata.awb).not.toBe(metadata.purchaseOrderNo);
	});

	it('falls back to null fields (not a thrown error) when the Product Details table is missing', async () => {
		const [{ metadata }] = await extractAll([
			{ sku: 'SKU-A', orderNo: '500000000000000001_1', awb: '9400000000000001', omitProductTable: true },
		]);
		expect(metadata.sku).toBeNull();
		expect(metadata.orderNo).toBeNull();
		// Still recoverable independently of the product table.
		expect(metadata.awb).toBe('9400000000000001');
	});

	it('reports boundary not found (falling back gracefully) when the template has no TAX INVOICE heading', async () => {
		const [{ boundary, metadata }] = await extractAll([
			{ sku: 'SKU-A', orderNo: '600000000000000001_1', awb: '9500000000000001', omitBoundaryAnchor: true },
		]);
		expect(boundary.found).toBe(false);
		expect(boundary.splitY).toBeNull();
		// Metadata extraction still works using the whole page as the "label region" search space.
		expect(metadata.sku).toBe('SKU-A');
	});

	it('handles a multi-page batch, one order per page, independently', async () => {
		const results = await extractAll([
			{ sku: 'SKU-A', orderNo: '700000000000000001_1', awb: '9600000000000001', courier: 'Delhivery' },
			{ sku: 'SKU-B', orderNo: '700000000000000002_1', awb: '9600000000000002', courier: 'Ekart' },
		]);
		expect(results).toHaveLength(2);
		expect(results[0].metadata.sku).toBe('SKU-A');
		expect(results[0].metadata.courier).toBe('Delhivery');
		expect(results[1].metadata.sku).toBe('SKU-B');
		expect(results[1].metadata.courier).toBe('Ekart');
	});
});
