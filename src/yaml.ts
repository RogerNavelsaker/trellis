function quoteScalar(value: string): string {
	if (value === "" || /[:#[\]{}]/.test(value) || value.includes("\n") || value.startsWith(" ")) {
		return JSON.stringify(value);
	}
	return value;
}

export function serializeYaml(record: Record<string, string | string[] | undefined>): string {
	const lines: string[] = [];

	for (const [key, value] of Object.entries(record)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				lines.push(`  - ${quoteScalar(item)}`);
			}
			continue;
		}
		if (value.includes("\n")) {
			lines.push(`${key}: |`);
			for (const line of value.split("\n")) {
				lines.push(`  ${line}`);
			}
			continue;
		}
		lines.push(`${key}: ${quoteScalar(value)}`);
	}

	return `${lines.join("\n")}\n`;
}

function parseScalar(value: string): string {
	const trimmed = value.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return JSON.parse(trimmed) as string;
	}
	return trimmed;
}

export function parseYaml(text: string): Record<string, string | string[]> {
	const result: Record<string, string | string[]> = {};
	const lines = text.replace(/\r\n/g, "\n").split("\n");

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (line === undefined || !line.trim()) continue;
		if (line.startsWith("  ")) continue;

		const separator = line.indexOf(":");
		if (separator === -1) continue;
		const key = line.slice(0, separator).trim();
		const remainder = line.slice(separator + 1).trim();

		if (remainder === "|") {
			const block: string[] = [];
			let cursor = index + 1;
			for (; cursor < lines.length; cursor++) {
				const next = lines[cursor];
				if (next === undefined || !next.startsWith("  ")) break;
				block.push(next.slice(2));
			}
			result[key] = block.join("\n").replace(/\n+$/, "");
			index = cursor - 1;
			continue;
		}

		if (remainder === "") {
			const items: string[] = [];
			let cursor = index + 1;
			for (; cursor < lines.length; cursor++) {
				const next = lines[cursor];
				if (next === undefined || !next.startsWith("  - ")) break;
				items.push(parseScalar(next.slice(4)));
			}
			result[key] = items;
			index = cursor - 1;
			continue;
		}

		result[key] = parseScalar(remainder);
	}

	return result;
}
