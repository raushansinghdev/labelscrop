import { z } from 'zod';
import type { OptionConfig } from '@/lib/options/schema';

// Bumping either version discards old/incompatible saved data rather than partially applying it — see
// `loadPlatformSettings`/`loadUiMode` below, which fall back to `null` (caller uses schema defaults) on any
// parse failure. Only option *values* are ever persisted here — never uploaded file content or extracted
// order data, none of which is sensitive but also simply has no reason to survive a page reload.
const SETTINGS_SCHEMA_VERSION = 1;
const UI_SCHEMA_VERSION = 1;

const configSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));

function settingsKey(platformId: string): string {
	return `labelscrop:settings:${platformId}:v${SETTINGS_SCHEMA_VERSION}`;
}

const uiKey = `labelscrop:ui:v${UI_SCHEMA_VERSION}`;
const uiModeSchema = z.enum(['simple', 'advanced']);

/** Reads saved option values for a platform. Returns `null` (never throws) on missing data, a Safari-private-
 * mode storage exception, or a value that no longer matches the expected shape — callers merge this over
 * `resolveDefaultConfig()`, so a `null` here just means "use defaults." */
export function loadPlatformSettings(platformId: string): OptionConfig | null {
	try {
		const raw = localStorage.getItem(settingsKey(platformId));
		if (!raw) return null;
		const parsed = configSchema.safeParse(JSON.parse(raw));
		return parsed.success ? (parsed.data as OptionConfig) : null;
	} catch {
		return null;
	}
}

export function savePlatformSettings(platformId: string, config: OptionConfig): void {
	try {
		localStorage.setItem(settingsKey(platformId), JSON.stringify(config));
	} catch {
		// Storage unavailable or full — non-critical, the session just keeps the in-memory config.
	}
}

export function loadUiMode(): 'simple' | 'advanced' | null {
	try {
		const raw = localStorage.getItem(uiKey);
		if (!raw) return null;
		const parsed = uiModeSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function saveUiMode(mode: 'simple' | 'advanced'): void {
	try {
		localStorage.setItem(uiKey, JSON.stringify(mode));
	} catch {
		// Non-critical — see savePlatformSettings.
	}
}

/** Asks the browser to mark this site's storage as persistent, so saved options aren't wiped when the device
 * runs low on space (by default localStorage is "best effort" and can be evicted). Chrome and Safari decide
 * silently from how often the site is used, so daily users get it without any prompt. Firefox would show a
 * permission popup instead, which is too much for a settings nicety, so it's skipped there. Never throws. */
export async function requestPersistentStorage(): Promise<void> {
	try {
		if (/Firefox\//.test(navigator.userAgent) || !navigator.storage?.persist) return;
		if (await navigator.storage.persisted()) return;
		await navigator.storage.persist();
	} catch {
		// Unsupported or denied — the options are still saved, just without the eviction guarantee.
	}
}
