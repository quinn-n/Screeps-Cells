import { ROLE_WORKER_CREEP, type WorkerCreepTask } from "./creep.types";
import type { BaseRoom } from "./room";

import _ from "lodash";
import type { RoomID } from "./types";
import type { WorkerCreep } from "./creep.worker";
import { mean } from "./misc";
import { getCreepsByRole } from "./creep";

interface DepositRecord {
	time: number;
	workMoveRatio: number;
}

interface AllocatorMemory {
	/**
	 * Record of times taken for a harvester to deposit its energy and return to the source
	 */
	_sourceDepositTimes: Record<Id<Source>, DepositRecord[]>;
	_collectionTimes: Record<RoomID, number[]>;
}

export default class BaseAllocator {
	public constructor() {
		if (Memory.allocator === undefined) {
			Memory.allocator = {};
		}
		if (Memory.allocator._sourceDepositTimes === undefined) {
			Memory.allocator._sourceDepositTimes = {};
		}
		if (Memory.allocator._collectionTimes === undefined) {
			Memory.allocator._collectionTimes = {};
		}
		this.memory = Memory.allocator;
	}

	/**
	 * Get the estimated energy extraction from a source per regen cycle
	 * @param source (Source) The source to calculate the extraction rate for
	 * @returns (number) The estimated energy extraction per regen cycle
	 */
	public getEstimatedSourceExtractionPerCycle(
		source: Source,
		task?: WorkerCreepTask,
	) {
		const currentAssignedCreeps = this.getAssignedCreeps(source, task);
		const currentExtractionRate = _.sum(
			currentAssignedCreeps.map((creep) =>
				this.calculateTotalExtractionPerCycle(source, creep as WorkerCreep),
			),
		);

		return currentExtractionRate;
	}

	/**
	 * Get all the creeps assigned to a source
	 */
	public getAssignedCreeps(source: Source, targetTask?: WorkerCreepTask) {
		const workerCreeps = getCreepsByRole(ROLE_WORKER_CREEP) as WorkerCreep[];

		return _.filter(workerCreeps, (creep: WorkerCreep) => {
			const hasMatchingTargetTask =
				targetTask === undefined || creep.targetTask === targetTask;

			return creep.memory.targetSource === source.id && hasMatchingTargetTask;
		});
	}

	/**
	 * Calculates the predicted energy extracted from a source by a given creep per regen cycle
	 * @param source (Source) The source to calculate the extraction rate for
	 * @param creep (WorkerCreep) The creep to calculate the extraction rate for
	 * @returns (number) The total energy extracted per regen cycle
	 */
	public calculateTotalExtractionPerCycle(source: Source, creep: WorkerCreep) {
		return this.calculateTotalExtractionRate(source, creep) * ENERGY_REGEN_TIME;
	}

	/**
	 * Calculate the total extraction rate per tick of a source by a given creep
	 * including the time taken to deposit the energy and return to the source
	 * @param source (Source) The source to calculate the extraction rate for
	 * @param creep (WorkerCreep) The creep to calculate the extraction rate for
	 * @returns (number) The total extraction rate
	 */
	public calculateTotalExtractionRate(source: Source, creep: WorkerCreep) {
		const storageCapacity = creep.store.getCapacity();
		const extractionTime = this.getExtractionTime(creep);

		return (
			storageCapacity / (extractionTime + this.getAverageDepositTime(source))
		);
	}

	/**
	 * Calculates the mean extraction time for a given source
	 * TODO: Change this to work with a move:work ratio for a more accurate per-creep time
	 */
	public getAverageDepositTime(source: Source) {
		if (
			this.memory._sourceDepositTimes[source.id] === undefined ||
			this.memory._sourceDepositTimes[source.id].length === 0
		) {
			return 1;
		}
		return mean(
			this.memory._sourceDepositTimes[source.id].map((record) => record.time),
		);
	}

	/**
	 * Calculate the time taken to fill a creep's storage capacity from a source
	 */
	public getExtractionTime(creep: WorkerCreep) {
		const workSegments = creep.body.filter((part) => part.type === WORK).length;
		const storageCapacity = creep.store.getCapacity();
		const extractionRate = workSegments * HARVEST_POWER;
		return storageCapacity / extractionRate;
	}

	/**
	 * Add a new collection time to the room's history.
	 * If the history is longer than HISTORY_LENGTH, remove the oldest entries.
	 * @param room (BaseRoom) The room to add a collection time for
	 * @param time (number) The time taken to collect the energy
	 */
	public addCollectionTime(room: BaseRoom, time: number) {
		if (this.memory._collectionTimes[room.name] === undefined) {
			this.memory._collectionTimes[room.name] = [];
		}

		this.memory._collectionTimes[room.name].unshift(time);
		while (
			this.memory._collectionTimes[room.name].length >
			BaseAllocator.HISTORY_LENGTH
		) {
			this.memory._collectionTimes[room.name].pop();
		}
	}

	public memory: AllocatorMemory;

	public static HISTORY_LENGTH = 5;
}
