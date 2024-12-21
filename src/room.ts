import { type CreepType, CreepWorker } from "./creep.types";
import type { Ticker } from "./ticker";
import type { BaseCreep, StorageStructure } from "./types";

interface BaseRoomMemory extends RoomMemory {
	spawnQueue: SpawnQueueEntry[];
}

interface SpawnQueueEntry {
	body: BodyPartConstant[];
	name: string;
	opts: SpawnOptions;
}

export class BaseRoom extends Room implements Ticker {
	public tick() {
		this.spawnCreepsFromQueue();
	}

	/**
	 * Spawns as many creeps as possible from the spawn queue
	 */
	public spawnCreepsFromQueue() {
		do {
			const spawn = this.getFreeSpawn();
			if (spawn === null) {
				return;
			}

			const queueEntry = this.memory.spawnQueue.shift();
			if (queueEntry === undefined) {
				return;
			}

			const { body, name, opts } = queueEntry;
			const spawnError = spawn.spawnCreep(body, name, opts);
			if (spawnError === ERR_NOT_ENOUGH_ENERGY) {
				return;
			}
		} while (this.memory.spawnQueue.length > 0);
	}

	/**
	 * Get the first spawn that is not currently spawning
	 */
	public getFreeSpawn() {
		const spawns = this.find(FIND_MY_SPAWNS);
		for (const spawn of spawns) {
			if (!spawn.spawning) {
				return spawn;
			}
		}
		return null;
	}

	public addCreepToSpawnQueue(
		body: BodyPartConstant[],
		name: string,
		opts: SpawnOptions,
	) {
		this.memory.spawnQueue.push({ body, name, opts });
	}

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

	public memory: BaseRoomMemory = this.memory;
}
