import type { BaseCreep } from "./creep.base";
import type { CreepMemoryMap, CreepType } from "./creep.types";
import type { Ticker } from "./ticker";
import type { StorageStructure } from "./types";

interface BaseRoomMemory extends RoomMemory {
	spawnQueue: SpawnQueueEntry<CreepType>[];
}

interface SpawnQueueOptions<Creep_T extends CreepType> extends SpawnOptions {
	memory?: Partial<CreepMemoryMap[Creep_T]>;
}

interface SpawnQueueEntry<Creep_T extends CreepType> {
	role: Creep_T;
	body: BodyPartConstant[];
	name: string;
	opts: SpawnQueueOptions<Creep_T>;
}

export class BaseRoom extends Room implements Ticker {
	public constructor(roomId: string) {
		super(roomId);

		this.initializeMemory();

		// controller is not made available by the constructor
		this.controller = Game.rooms[roomId].controller;
	}

	/**
	 * Instantiates a new BaseRoom object from a Room object
	 * @param room (Room)
	 * @returns (BaseRoom)
	 */
	public static fromRoom(room: Room) {
		return new BaseRoom(room.name);
	}

	/**
	 * Initialize the room's memory
	 */
	private initializeMemory() {
		if (this.memory.spawnQueue === undefined) {
			this.memory.spawnQueue = [];
		}
	}

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

			const { body, name, opts, role } = queueEntry;
			if (opts.memory === undefined) {
				opts.memory = {};
			}
			opts.memory.role = role;

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

	/**
	 * Add a creep to the spawn queue.
	 * Role is automatically saved to the creep's memory
	 * @param role (CreepType) The creep's role.
	 * @param body (BodyPartConstant[]) The body parts of the creep.
	 * @param name (string) The name of the creep.
	 * @param opts (SpawnQueueOptions) The options for spawning the creep.
	 */
	public addCreepToSpawnQueue<Creep_T extends CreepType>(
		role: Creep_T,
		body: BodyPartConstant[],
		name: string,
		opts: SpawnQueueOptions<Creep_T> = {},
	) {
		this.memory.spawnQueue.push({ body, name, opts, role });
	}

	/**
	 * Check if a creep with the given role is in the spawn queue
	 * @param role (CreepType) The role to check for
	 * @returns (boolean)
	 */
	public hasRoleInSpawnQueue(role: CreepType) {
		return this.memory.spawnQueue.some((entry) => {
			return entry.role === role;
		});
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
				filter: (structure: OwnedStructure) => {
					if (!("store" in structure)) {
						return false;
					}
					const storageStructure = structure as StorageStructure;
					const freeCapacity = storageStructure.store.getFreeCapacity(resource);
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
