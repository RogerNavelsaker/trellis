/**
 * Base error class for all Trellis errors.
 * Includes a machine-readable `code` field for programmatic handling.
 */
export class TrellisError extends Error {
	readonly code: string;

	constructor(message: string, code: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "TrellisError";
		this.code = code;
	}
}

/**
 * Raised when artifact storage or retrieval fails.
 */
export class StorageError extends TrellisError {
	readonly path: string | null;

	constructor(
		message: string,
		context?: {
			path?: string;
			code?: string;
			cause?: Error;
		},
	) {
		super(message, context?.code ?? "STORAGE_ERROR", { cause: context?.cause });
		this.name = "StorageError";
		this.path = context?.path ?? null;
	}
}

/**
 * Raised when artifact validation fails (schema, lifecycle rules).
 */
export class ValidationError extends TrellisError {
	constructor(message: string, code = "VALIDATION_ERROR") {
		super(message, code);
		this.name = "ValidationError";
	}
}

/**
 * Raised when a transition is blocked by lifecycle rules.
 */
export class TransitionError extends TrellisError {
	constructor(message: string) {
		super(message, "TRANSITION_ERROR");
		this.name = "TransitionError";
	}
}
