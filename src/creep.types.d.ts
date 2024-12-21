import type { BaseCreepMemory, ROLE_BASE_CREEP } from "./creep.base";
import type {
	ROLE_WORKER_CREEP,
	WorkerCreepMemory,
	WorkerCreepTask,
} from "./creep.worker";

export type CreepType = ROLE_BASE_CREEP | ROLE_WORKER_CREEP;

export type CreepTask = "" | WorkerCreepTask;

export interface CreepMemoryMap {
	[ROLE_BASE_CREEP]: BaseCreepMemory;
	[ROLE_WORKER_CREEP]: WorkerCreepMemory;
}
