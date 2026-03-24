export function compactPatch<T extends object>(patch: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	) as Partial<T>;
}
