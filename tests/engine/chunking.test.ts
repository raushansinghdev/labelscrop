import { describe, expect, it } from 'vitest';
import { chunkArray } from '@/lib/engine/chunking';

describe('chunkArray', () => {
	it('splits into even chunks', () => {
		expect(chunkArray([1, 2, 3, 4, 5, 6], 2)).toEqual([
			[1, 2],
			[3, 4],
			[5, 6],
		]);
	});

	it('leaves a smaller final chunk when it does not divide evenly', () => {
		expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});

	it('returns an empty array for an empty input', () => {
		expect(chunkArray([], 10)).toEqual([]);
	});

	it('returns one chunk when chunkSize exceeds the input length', () => {
		expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
	});

	it('throws for a non-positive chunk size', () => {
		expect(() => chunkArray([1, 2, 3], 0)).toThrow();
		expect(() => chunkArray([1, 2, 3], -1)).toThrow();
	});
});
