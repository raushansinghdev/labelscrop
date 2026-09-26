/** Prefixes a root-absolute path with the configured Astro `base` so links and assets keep working when the site is
 * served from a sub-path (e.g. GitHub Pages project sites at /labelscrop/). A no-op when base is '/'.
 *
 * Page paths also get a trailing slash. Pages are built as `/guides/index.html`, so `/guides/` is the URL that
 * exists and the one the canonical and sitemap name; hosts answer `/guides` with a 308 to it. Written without the
 * slash, every nav click paid a redirect round trip, and every hreflang tag pointed at a redirect, which Google
 * ignores rather than follows. Files (anything whose last segment has a dot) are left alone. */
export function url(path: string): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return `${base}${withTrailingSlash(path)}`;
}

export function withTrailingSlash(path: string): string {
	const split = path.search(/[?#]/);
	const pathname = split === -1 ? path : path.slice(0, split);
	const rest = split === -1 ? '' : path.slice(split);
	const last = pathname.slice(pathname.lastIndexOf('/') + 1);
	if (pathname.endsWith('/') || last.includes('.')) return path;
	return `${pathname}/${rest}`;
}
