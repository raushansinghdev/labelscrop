/** Prefixes a root-absolute path with the configured Astro `base` so links and assets keep working when the site is
 * served from a sub-path (e.g. GitHub Pages project sites at /labelscrop/). A no-op when base is '/'. */
export function url(path: string): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return path === '/' ? `${base}/` : `${base}${path}`;
}
