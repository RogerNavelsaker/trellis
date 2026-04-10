/**
 * A specification record (Spec).
 * Durable intent, constraints, and acceptance criteria.
 */
export interface SpecRecord {
	/** Unique kebab-case identifier (e.g. auth-redesign) */
	id: string;
	/** Human-readable title */
	title: string;
	/** Optional linked Seeds issue ID */
	seed?: string;
	/** Lifecycle status */
	status: "draft" | "active" | "done";
	/** ISO 8601 creation timestamp */
	createdAt: string;
	/** ISO 8601 last update timestamp */
	updatedAt: string;
	/** ISO 8601 completion timestamp (if status is done) */
	completedAt?: string;
	/** Final outcome summary (if status is done) */
	completionSummary?: string;
	/** The core objective or body of the spec */
	objective: string;
	/** List of architectural or business constraints */
	constraints: string[];
	/** List of verifiable acceptance criteria */
	acceptance: string[];
	/** List of relevant paths or URLs */
	references: string[];
}

/**
 * A plan record (Plan).
 * Execution shape and status transitions for a spec.
 */
export interface PlanRecord {
	/** Unique kebab-case identifier (e.g. auth-redesign-v1) */
	id: string;
	/** Human-readable title */
	title: string;
	/** Optional linked Seeds issue ID */
	seed?: string;
	/** Optional linked Trellis spec ID */
	spec?: string;
	/** Lifecycle status */
	status: "draft" | "active" | "blocked" | "done";
	/** ISO 8601 creation timestamp */
	createdAt: string;
	/** ISO 8601 last update timestamp */
	updatedAt: string;
	/** ISO 8601 completion timestamp (if status is done) */
	completedAt?: string;
	/** Final outcome summary (if status is done) */
	completionSummary?: string;
	/** Plan-specific summary or intent */
	summary: string;
	/** List of tactical execution steps */
	steps: string[];
}

/**
 * A handoff record.
 * Append-only log of context/ownership transfer.
 */
export interface HandoffRecord {
	/** ISO 8601 event timestamp */
	timestamp: string;
	/** The plan ID this handoff belongs to */
	plan: string;
	/** Identity of the sender (human or agent) */
	from: string;
	/** Identity of the recipient (human or agent) */
	to: string;
	/** Handoff summary and context */
	summary: string;
	/** Optional linked spec ID */
	spec?: string;
	/** Optional linked Seeds issue ID */
	seed?: string;
}

/**
 * A system event record.
 * Audit trail for transitions and handoffs.
 */
export interface EventRecord {
	/** ISO 8601 event timestamp */
	timestamp: string;
	/** Event type identifier */
	type: "spec.transition" | "plan.transition" | "handoff.append";
	/** Kind of artifact the event relates to */
	artifactKind: "spec" | "plan" | "handoff";
	/** ID of the related artifact */
	artifactId: string;
	/** Previous status (for transitions) */
	fromStatus?: string;
	/** New status (for transitions) */
	toStatus?: string;
	/** Identity of the sender (for handoffs) */
	from?: string;
	/** Identity of the recipient (for handoffs) */
	to?: string;
	/** Summary or intent of the event */
	summary?: string;
	/** Linked spec ID */
	spec?: string;
	/** Linked Seeds issue ID */
	seed?: string;
	/** Linked plan ID */
	plan?: string;
}
