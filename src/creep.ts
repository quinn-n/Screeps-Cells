import type { BaseCreepMemory } from "./creep.base";
import { ROLE_WORKER_CREEP } from "./creep.types";
import { WorkerCreep } from "./creep.worker";

/**
 * Instantiates a new BaseCreep object from a Creep object depending on the creep's role
 * @param creep (Creep) - Really a Creep object but with a BaseCreep's memory
 * @returns
 */
export function createCreepInstance(creep: Creep) {
	const memory = creep.memory as BaseCreepMemory;
	switch (memory.role) {
		case ROLE_WORKER_CREEP:
			return WorkerCreep.fromCreep(creep);
		default:
			throw new Error(`Unknown creep role: ${memory.role}`);
	}
}
