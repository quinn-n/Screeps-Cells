import type { BaseCreepMemory } from "./creep.base";
import type { WorkerCreepMemory } from "./creep.worker";

export type CreepType = ROLE_BASE_CREEP | ROLE_WORKER_CREEP;

export type CreepTask = "" | WorkerCreepTask;

export type ROLE_BASE_CREEP = "base_creep";
export const ROLE_BASE_CREEP: ROLE_BASE_CREEP = "base_creep";

export type ROLE_WORKER_CREEP = "worker";
export const ROLE_WORKER_CREEP: ROLE_WORKER_CREEP = "worker";

export type WORKER_TASK_HARVESTING = "harvesting";
export type WORKER_TASK_DEPOSITING = "depositing";
export type WORKER_TASK_UPGRADING = "upgrading";
export type WORKER_TASK_BUILDING = "building";
export type WORKER_TASK_REPAIRING = "repairing";

export const WORKER_TASK_HARVESTING: WORKER_TASK_HARVESTING = "harvesting";
export const WORKER_TASK_DEPOSITING: WORKER_TASK_DEPOSITING = "depositing";
export const WORKER_TASK_UPGRADING: WORKER_TASK_UPGRADING = "upgrading";
export const WORKER_TASK_BUILDING: WORKER_TASK_BUILDING = "building";
export const WORKER_TASK_REPAIRING: WORKER_TASK_REPAIRING = "repairing";

export type WorkerCreepTask =
	| WORKER_TASK_HARVESTING
	| WORKER_TASK_DEPOSITING
	| WORKER_TASK_UPGRADING
	| WORKER_TASK_BUILDING
	| WORKER_TASK_REPAIRING;

export interface CreepMemoryMap {
	[ROLE_BASE_CREEP]: BaseCreepMemory;
	[ROLE_WORKER_CREEP]: WorkerCreepMemory;
}
