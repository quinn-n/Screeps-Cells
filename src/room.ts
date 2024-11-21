import { type CreepType, CreepWorker } from "./creep.types";
import type { Ticker } from "./ticker";
import type { BaseCreep, StorageStructure } from "./types";

interface BaseRoomMemory extends RoomMemory {
	_creepTravelTimes: {
		[key in CreepType]: number[];
	};
}

export class BaseRoom extends Room implements Ticker {
	public tick() {}
	public getCreeps(role?: CreepType) {
		return this.find(FIND_MY_CREEPS, {
			filter: (creep: BaseCreep) => {
				if (creep.memory.home !== this.name) {
					return false;
				}
				if (!role) {
					return true;
				}
				return creep.memory.role === role;
			},
		});
	}

	public getAvailableSources() {
		const creeps = this.getCreeps(CreepWorker);
		const sources = this.find(FIND_SOURCES_ACTIVE);

		// TODO: Change this filter to use the estimated remaining energy available per cycle
		return sources.filter((source) => {
			const creepsNearSource = source.pos.findInRange(creeps, 1);
			const openSpaceNearSource =
				8 - source.pos.findInRange(TERRAIN_MASK_WALL, 1).length;
			if (creepsNearSource.length < openSpaceNearSource) {
				return true;
			}
			return false;
		});
	}

	/**
	 * Find a storage structure that can store the given resource
	 * @param resource (ResourceConstant) The resource to store
	 * @returns (StorageStructure | ERR_FULL) The storage structure or ERR_FULL if no storage is available
	 */
	public findStorageWithSpace(resource: ResourceConstant) {
		const structurePriority: StructureConstant[][] = [
			[STRUCTURE_LINK, STRUCTURE_SPAWN, STRUCTURE_EXTENSION],
			[STRUCTURE_TOWER],
			[STRUCTURE_STORAGE],
		];
		for (const priority of structurePriority) {
			const structures = this.find(FIND_MY_STRUCTURES, {
				filter: (structure: StorageStructure) => {
					const freeCapacity = structure.store.getFreeCapacity(resource);
					// free capacity is null if the structure can't store the resource
					if (freeCapacity === null) {
						return false;
					}
					return priority.includes(structure.structureType) && freeCapacity > 0;
				},
			});
			if (structures.length > 0) {
				return structures[0];
			}
		}
		return ERR_FULL;
	}
}
