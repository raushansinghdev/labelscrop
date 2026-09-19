/** Splits `items` into fixed-size groups, preserving order. Used to process large uploads in bounded-memory
 * batches (see the plan's memory/scale strategy) rather than holding an entire multi-hundred-page job's
 * intermediate state in memory at once. */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	if (chunkSize <= 0) throw new Error('chunkSize must be a positive integer');

	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += chunkSize) {
		chunks.push(items.slice(i, i + chunkSize));
	}
	return chunks;
}
