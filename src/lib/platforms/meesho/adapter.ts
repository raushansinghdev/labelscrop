import type { PlatformAdapter } from '@/lib/engine/types';
import { detectMeeshoBoundary } from './boundaryDetect';
import { MEESHO_LAYOUTS } from './layouts';
import { extractMeeshoMetadata } from './metadataExtract';

export const meeshoAdapter: PlatformAdapter = {
	id: 'meesho',
	label: 'Meesho',
	detectBoundary: detectMeeshoBoundary,
	extractMetadata: extractMeeshoMetadata,
	layouts: MEESHO_LAYOUTS,
};
