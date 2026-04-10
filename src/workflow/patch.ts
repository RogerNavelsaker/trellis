/**
 * Creates a partial object containing only the defined (non-undefined) properties of the input.
 */
export function compactPatch<T extends object>(patch: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	) as Partial<T>;
}
