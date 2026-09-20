/**
 * The lucide glyphs the dashboard labels its cards with, as raw path data.
 *
 * The React components can't be used here — there is no DOM to render them into — so the paths
 * are lifted from `lucide-react`'s own icon data and stroked straight onto the page. They are
 * authored in a 24×24 box, which is what `Sheet.icon` scales from. Rect and polyline nodes are
 * written out as paths; everything else is verbatim.
 *
 * Keep these in step with the icons the components import, or the report starts labelling its
 * cards with something other than the screen does.
 */
export const ICONS = {
	banknote: ["M 4 6 H 20 A 2 2 0 0 1 22 8 V 16 A 2 2 0 0 1 20 18 H 4 A 2 2 0 0 1 2 16 V 8 A 2 2 0 0 1 4 6 Z","M 10 12 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0","M6 12h.01M18 12h.01"],
	package: ["M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z","M12 22V12","M 3.29 7 L 12 12 L 20.71 7","m7.5 4.27 9 5.15"],
	megaphone: ["M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z","M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14","M8 6v8"],
	building: ["M12 10h.01","M12 14h.01","M12 6h.01","M16 10h.01","M16 14h.01","M16 6h.01","M8 10h.01","M8 14h.01","M8 6h.01","M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3","M 6 2 H 18 A 2 2 0 0 1 20 4 V 20 A 2 2 0 0 1 18 22 H 6 A 2 2 0 0 1 4 20 V 4 A 2 2 0 0 1 6 2 Z"],
	shoppingBag: ["M16 10a4 4 0 0 1-8 0","M3.103 6.034h17.794","M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"],
	trophy: ["M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2","M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2","M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3","M4 22h16","M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z","M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"],
	trendingDown: ["M16 17h6v-6","m22 17-8.5-8.5-5 5L2 7"],
	rotateCcw: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","M3 3v5h5"],
	/** The site header's own mark: a document with a tick. */
	logo: ['M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M14 3v5h5', 'm9.5 13.5 2 2 4-4.5'],
} as const;

export type IconName = keyof typeof ICONS;
