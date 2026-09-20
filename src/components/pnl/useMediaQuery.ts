import { useEffect, useState } from 'react';

/**
 * Whether a CSS media query currently matches.
 *
 * Layout belongs in CSS, and almost everything here is done with Tailwind's breakpoints. This
 * exists for the one thing a class name cannot change: which *chart* recharts draws. A waterfall
 * with eight bars needs its labels rotated to 40 degrees to fit a phone, which is a chart you
 * tilt your head to read — so on a narrow screen the whole thing is drawn on its side instead,
 * and that is a different component tree, not a different stylesheet.
 *
 * Starts `false` on the server and on the first client paint, then corrects itself in an effect:
 * this island is server-rendered, where `matchMedia` does not exist, and a hydration mismatch is
 * a worse bug than one frame of the desktop layout.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const list = window.matchMedia(query);
		setMatches(list.matches);
		const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
		list.addEventListener('change', onChange);
		return () => list.removeEventListener('change', onChange);
	}, [query]);

	return matches;
}
