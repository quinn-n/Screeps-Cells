import _ from "lodash";
import type { BaseCreep, BaseCreepMemory } from "./creep.base";
import { type CreepType, ROLE_WORKER_CREEP } from "./creep.types";
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

export function getCreepsByRole(role: CreepType): BaseCreep[] {
	return _.filter(
		Game.creeps,
		(creep: Creep) => (creep as BaseCreep).memory.role === role,
	) as BaseCreep[];
}
