import { findBoundaryByAnchor } from '@/lib/engine/boundary';
import type { BoundaryResult, PageTextModel } from '@/lib/engine/types';

// Confirmed against a real 59-page Meesho/Delhivery export: this heading appears immediately after the
// Product Details table on every page, directly above the tax invoice section.
const TAX_INVOICE_ANCHOR = /^TAX INVOICE\b/i;

export function detectMeeshoBoundary(page: PageTextModel): BoundaryResult {
	return findBoundaryByAnchor(page.items, TAX_INVOICE_ANCHOR);
}
