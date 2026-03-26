import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readEvents } from "../storage/events.ts";
import { readHandoffs } from "../storage/handoffs.ts";
import { listPlans } from "../storage/plans.ts";
import { listSpecs } from "../storage/specs.ts";
import { TRELLIS_DIR } from "../system/init.ts";
import type { EventRecord, PlanRecord, SpecRecord } from "../types.ts";

/**
 * Result of a blocked plan audit.
 */
export interface BlockedPlanAudit {
	/** The blocked plan record */
	plan: PlanRecord;
	/** Latest reason provided during the transition to blocked */
	latestBlockReason?: string;
	/** Timestamp of the most recent block event */
	blockedAt?: string;
}

/**
 * Result of a stale artifact audit.
 */
export interface StaleArtifactAudit {
	/** Artifact kind (spec or plan) */
	kind: "spec" | "plan";
	/** Artifact ID */
	id: string;
	/** Current lifecycle status */
	status: string;
	/** Timestamp of the last recorded event or update */
	lastActivityAt: string;
	/** Full days since the last activity */
	staleDays: number;
	/** Optional linked Seeds issue ID */
	seed?: string;
	/** Optional linked spec ID (for plans) */
	spec?: string;
}

/**
 * Result of an orphaned artifact audit.
 */
export interface OrphanedAudit {
	/** Specs that have no linked plans */
	specsWithoutPlans: SpecRecord[];
	/** Plans that link to a non-existent spec ID */
	plansWithMissingSpecs: PlanRecord[];
	/** Handoff log files that have no matching plan record */
	handoffsForMissingPlans: Array<{ plan: string; count: number }>;
}

/**
 * Identifies plans in the 'blocked' status and extracts their latest block reason.
 */
export async function auditBlocked(root: string): Promise<BlockedPlanAudit[]> {
	const events = await readEvents(root);
	const blockedPlans = await listPlans(root, { status: "blocked" });
	return blockedPlans.map((plan) => {
		const latestBlock = latestMatchingEvent(
			events,
			(event) =>
				event.type === "plan.transition" &&
				event.artifactId === plan.id &&
				event.toStatus === "blocked",
		);
		return {
			plan,
			latestBlockReason: latestBlock?.summary,
			blockedAt: latestBlock?.timestamp,
		};
	});
}

/**
 * Identifies active or blocked artifacts with no recorded activity for a specific number of days.
 */
export async function auditStale(
	root: string,
	days: number,
	now = new Date(),
): Promise<StaleArtifactAudit[]> {
	const events = await readEvents(root);
	const cutoffMs = days * 24 * 60 * 60 * 1000;
	const specs = (await listSpecs(root)).filter((spec) => spec.status !== "done");
	const plans = (await listPlans(root)).filter((plan) => plan.status !== "done");
	const records: StaleArtifactAudit[] = [];

	for (const spec of specs) {
		const lastActivityAt = latestArtifactActivity(events, "spec", spec.id) ?? spec.updatedAt;
		const staleMs = now.getTime() - new Date(lastActivityAt).getTime();
		if (staleMs >= cutoffMs) {
			records.push({
				kind: "spec",
				id: spec.id,
				status: spec.status,
				lastActivityAt,
				staleDays: Math.floor(staleMs / (24 * 60 * 60 * 1000)),
				seed: spec.seed,
			});
		}
	}

	for (const plan of plans) {
		const lastActivityAt = latestArtifactActivity(events, "plan", plan.id) ?? plan.updatedAt;
		const staleMs = now.getTime() - new Date(lastActivityAt).getTime();
		if (staleMs >= cutoffMs) {
			records.push({
				kind: "plan",
				id: plan.id,
				status: plan.status,
				lastActivityAt,
				staleDays: Math.floor(staleMs / (24 * 60 * 60 * 1000)),
				seed: plan.seed,
				spec: plan.spec,
			});
		}
	}

	return records.sort((left, right) => left.lastActivityAt.localeCompare(right.lastActivityAt));
}

/**
 * Identifies broken linkages across specs, plans, and handoff logs.
 */
export async function auditOrphaned(root: string): Promise<OrphanedAudit> {
	const specs = await listSpecs(root);
	const plans = await listPlans(root);
	const planIds = new Set(plans.map((plan) => plan.id));

	const specsWithoutPlans = specs.filter((spec) => !plans.some((plan) => plan.spec === spec.id));
	const plansWithMissingSpecs: PlanRecord[] = [];
	for (const plan of plans) {
		if (!plan.spec) continue;
		const specExists = specs.some((spec) => spec.id === plan.spec);
		if (!specExists) plansWithMissingSpecs.push(plan);
	}

	const handoffFiles = (
		await readdir(join(root, TRELLIS_DIR, "handoffs"), {
			withFileTypes: true,
		}).catch(() => [])
	).filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"));
	const handoffsForMissingPlans = [];
	for (const file of handoffFiles) {
		const plan = file.name.replace(/\.jsonl$/, "");
		if (planIds.has(plan)) continue;
		const count = (await readHandoffs(root, plan)).length;
		handoffsForMissingPlans.push({ plan, count });
	}

	return {
		specsWithoutPlans,
		plansWithMissingSpecs: plansWithMissingSpecs.sort((a, b) => a.id.localeCompare(b.id)),
		handoffsForMissingPlans: handoffsForMissingPlans.sort((a, b) => a.plan.localeCompare(b.plan)),
	};
}

/**
 * Finds the latest recorded timestamp for a specific artifact in the event log.
 */
function latestArtifactActivity(
	events: EventRecord[],
	kind: "spec" | "plan",
	id: string,
): string | undefined {
	return latestMatchingEvent(
		events,
		(event) => event.artifactKind === kind && event.artifactId === id,
	)?.timestamp;
}

/**
 * Returns the most recent event matching a predicate.
 */
function latestMatchingEvent(
	events: EventRecord[],
	predicate: (event: EventRecord) => boolean,
): EventRecord | undefined {
	return [...events]
		.filter(predicate)
		.sort((left, right) => left.timestamp.localeCompare(right.timestamp))
		.at(-1);
}
