import type { LayoutPreset } from './types';

export interface CellRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Computes the bottom-left-origin rectangle for every label cell on one output page, top row first,
 * left to right within a row. A thermal preset (1 column, 1 row) yields a single cell spanning the page. */
export function computeCellRects(layout: LayoutPreset): CellRect[] {
	const { pageWidth, pageHeight, columns, rows, marginPt, gapPt } = layout;
	const usableWidth = pageWidth - marginPt * 2 - gapPt * (columns - 1);
	const usableHeight = pageHeight - marginPt * 2 - gapPt * (rows - 1);
	const cellWidth = usableWidth / columns;
	const cellHeight = usableHeight / rows;

	const cells: CellRect[] = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < columns; col++) {
			cells.push({
				x: marginPt + col * (cellWidth + gapPt),
				y: pageHeight - marginPt - (row + 1) * cellHeight - row * gapPt,
				width: cellWidth,
				height: cellHeight,
			});
		}
	}
	return cells;
}

export interface FitPlacement {
	/** Parameters to pass directly to pdf-lib's `page.drawPage(embeddedPage, { x, y, width, height, rotate })`. */
	x: number;
	y: number;
	width: number;
	height: number;
	rotateDeg: 0 | 90;
}

/** Scales a `sourceWidth x sourceHeight` embedded region to fit within `cell`, preserving aspect ratio and
 * centering it — trying both the normal and 90°-rotated orientation and picking whichever fills the cell
 * better (the "auto-rotate to fill each page" behavior every competitor tool offers for A4 sheets, and
 * which is just as useful for a single thermal label whose source region is wide-and-short but whose target
 * label stock is tall-and-narrow, or vice versa).
 *
 * The returned x/y/width/height account for how pdf-lib's `drawPage` rotates a drawn object around its
 * (x, y) origin *before* the width/height scaling is visually apparent — passing plain "centered in cell"
 * coordinates without this adjustment would draw a 90°-rotated page offset from where it visually belongs. */
export function fitContainAutoRotate(
	sourceWidth: number,
	sourceHeight: number,
	cell: CellRect,
): FitPlacement {
	const scaleNormal = Math.min(cell.width / sourceWidth, cell.height / sourceHeight);
	const scaleRotated = Math.min(cell.width / sourceHeight, cell.height / sourceWidth);

	if (scaleRotated > scaleNormal) {
		// pdf-lib draws the (still axis-aligned, in local space) object of size width x height, then rotates
		// that local space 90° around (x, y) — so the object's visual bounding box after rotation has
		// visual_width = height and visual_height = width, offset up-and-left from (x, y). Solving for the
		// (x, y) that centers that visual box in the cell gives the offsets below.
		const width = scaleRotated * sourceWidth;
		const height = scaleRotated * sourceHeight;
		return {
			x: cell.x + (cell.width + height) / 2,
			y: cell.y + (cell.height - width) / 2,
			width,
			height,
			rotateDeg: 90,
		};
	}

	const width = scaleNormal * sourceWidth;
	const height = scaleNormal * sourceHeight;
	return {
		x: cell.x + (cell.width - width) / 2,
		y: cell.y + (cell.height - height) / 2,
		width,
		height,
		rotateDeg: 0,
	};
}
