export function jsonOutput(command: string, data: Record<string, unknown>): void {
	console.log(JSON.stringify({ success: true, command, ...data }));
}

export function jsonError(command: string, error: string): void {
	console.log(JSON.stringify({ success: false, command, error }));
}
