import { SITE } from '@/lib/site';

export const FEEDBACK_EMAIL = 'singhraushan2410@gmail.com';

const SUBJECT = `${SITE.name}: Feature request / Bug report`;

/** Builds a `mailto:` link that opens the user's mail app with a short fill-in-the-blanks template, so
 * requests and bug reports arrive in a consistent shape. `page` and `device` are filled in on the client
 * (see Header.astro) — the static fallback href leaves them for the user. */
export function feedbackMailto(page = '', device = ''): string {
	const body = [
		`Hi ${SITE.name} team,`,
		'',
		'Type (feature request / bug report):',
		'',
		'What would you like, or what went wrong?',
		'',
		'',
		'Steps to reproduce (for bugs):',
		'1. ',
		'2. ',
		'',
		'Platform (Meesho / Amazon / Flipkart):',
		`Page: ${page}`,
		`Device / browser: ${device}`,
		'',
		'Tip: for a bug, attaching a screenshot helps a lot.',
		'',
		'Thanks!',
	].join('\n');
	return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
}

/** A short, human-readable device/browser string from the user agent, e.g. "Android · Chrome 128". */
export function describeDevice(userAgent: string): string {
	const os = /Android/i.test(userAgent)
		? 'Android'
		: /iPhone|iPad|iPod/i.test(userAgent)
			? 'iOS'
			: /Mac OS X/i.test(userAgent)
				? 'macOS'
				: /Windows/i.test(userAgent)
					? 'Windows'
					: /Linux/i.test(userAgent)
						? 'Linux'
						: 'Unknown OS';
	const names: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', FxiOS: 'Firefox', CriOS: 'Chrome', SamsungBrowser: 'Samsung Internet' };
	const named = userAgent.match(/(Edg|OPR|SamsungBrowser|Firefox|FxiOS|CriOS|Chrome)\/(\d+)/);
	if (named) return `${os} · ${names[named[1]] ?? named[1]} ${named[2]}`;
	const safari = userAgent.match(/Version\/(\d+).*Safari/);
	return safari ? `${os} · Safari ${safari[1]}` : os;
}
