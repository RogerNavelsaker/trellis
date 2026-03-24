export interface SpecRecord {
	id: string;
	title: string;
	seed?: string;
	status: "draft" | "active" | "done";
	createdAt: string;
	updatedAt: string;
	objective: string;
	constraints: string[];
	acceptance: string[];
	references: string[];
}

export interface PlanRecord {
	id: string;
	title: string;
	seed?: string;
	spec?: string;
	status: "draft" | "active" | "blocked" | "done";
	createdAt: string;
	updatedAt: string;
	summary: string;
	steps: string[];
}

export interface HandoffRecord {
	timestamp: string;
	plan: string;
	from: string;
	to: string;
	summary: string;
	spec?: string;
	seed?: string;
}

export interface EventRecord {
	timestamp: string;
	type: "spec.transition" | "plan.transition" | "handoff.append";
	artifactKind: "spec" | "plan" | "handoff";
	artifactId: string;
	fromStatus?: string;
	toStatus?: string;
	from?: string;
	to?: string;
	summary?: string;
	spec?: string;
	seed?: string;
	plan?: string;
}
