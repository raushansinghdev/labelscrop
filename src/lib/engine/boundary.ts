import type { BoundaryResult, TextItem } from './types';

/** Finds a label/invoice split line by locating text matching `anchorPattern` (e.g. a "TAX INVOICE" heading)
 * and returning the y-coordinate just above it. Platform-agnostic: a platform module supplies the pattern
 * that identifies its own template's boundary heading. If nothing matches, `found` is false rather than
 * throwing — callers should fall back to a default crop and surface a non-blocking warning (see the plan's
 * error-handling section), not fail the whole page. */
export function findBoundaryByAnchor(
	items: TextItem[],
	anchorPattern: RegExp,
	bufferPt = 3,
): BoundaryResult {
	const matches = items.filter((item) => anchorPattern.test(item.text));
	if (matches.length === 0) {
		return { found: false, splitY: null };
	}

	// If the anchor text was split across multiple runs (e.g. "TAX INVOICE" / "Original For Recipient"
	// rendered as separate items on the same visual row), take the highest one so the buffer clears the
	// whole heading rather than just whichever run happened to match first.
	const splitY = Math.max(...matches.map((item) => item.y)) + bufferPt;

	return { found: true, splitY };
}
