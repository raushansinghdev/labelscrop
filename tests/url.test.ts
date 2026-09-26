import { describe, expect, it } from 'vitest';
import { withTrailingSlash } from '@/lib/url';

describe('withTrailingSlash', () => {
	it('adds the slash to page paths', () => {
		expect(withTrailingSlash('/tools/meesho-label-cropper')).toBe('/tools/meesho-label-cropper/');
		expect(withTrailingSlash('/hi')).toBe('/hi/');
	});

	it('leaves the root and already-slashed paths alone', () => {
		expect(withTrailingSlash('/')).toBe('/');
		expect(withTrailingSlash('/guides/')).toBe('/guides/');
	});

	it('puts the slash before a fragment or query, not after it', () => {
		expect(withTrailingSlash('/faq#privacy')).toBe('/faq/#privacy');
		expect(withTrailingSlash('/tools?ref=x')).toBe('/tools/?ref=x');
	});

	it('never touches files', () => {
		expect(withTrailingSlash('/favicon.svg')).toBe('/favicon.svg');
		expect(withTrailingSlash('/og/home.png')).toBe('/og/home.png');
		expect(withTrailingSlash('/sitemap-index.xml')).toBe('/sitemap-index.xml');
	});
});
