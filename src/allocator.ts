import { generateCreepName } from "./creep.base";
import { ROLE_WORKER, type WorkerCreep } from "./creep.worker";
import type { CreepType } from "./role.room";
import type { BaseRoom } from "./room";
import type { Ticker } from "./ticker";
import type { BaseCreep } from "./types";

import _ from "lodash";

interface DepositRecord {
	time: number;
	amount: number;
	workMoveRatio: number;
}

const HISTORY_LENGTH = 5;

interface AllocatorMemory {
	/**
	 * Record of times taken for a harvester to deposit its energy and return to the source
	 */
	_sourceDepositTimes: Record<Id<Source>, DepositRecord[]>;
}

class Allocator implements Ticker {
	public tick() {}

	public allocateHarvesters(room: BaseRoom, harvestRatio: number) {
		const sources = room.find(FIND_SOURCES);
		for (const source of sources) {
			const energyToHarvest = source.energyCapacity * harvestRatio;
			this.removeExcessHarvesters(source, energyToHarvest);
			this.addRequiredHarvesters(source, energyToHarvest);
			const totalWorkRequiredPerCycle = energyToHarvest / HARVEST_POWER;

			// Harvest:deposit time ratio
			const harvestTimeRatio =
				HARVEST_POWER / CARRY_CAPACITY / this.getAverageDepositTime(source);
		}
	}

	/**
	 * Adds harvesters to a source until the estimated energy extraction per cycle.
	 * Pulls from unused creeps first, then spawns largest creeps possible.
	 */
	public addRequiredHarvesters(source: Source, minEnergy: number) {
		const currentEstimate = this.getEstimatedSourceExtractionPerCycle(source);
		let neededCapacity = minEnergy - currentEstimate;

		const unusedCreeps = _.filter(
			this.getCreepsByType(ROLE_WORKER),
			(creep: WorkerCreep) => {
				return creep.memory.targetSource === null;
			},
		) as WorkerCreep[];

		// Sort unused creeps from largest to smallest
		unusedCreeps.sort((a, b) => {
			return (
				this.calculateTotalExtractionPerCycle(source, b) -
				this.calculateTotalExtractionPerCycle(source, a)
			);
		});

		// Add unused creeps from largest to smallest until we reach the needed capacity
		let capacityAdded = 0;
		for (const creep of unusedCreeps) {
			const extractionRate = this.calculateTotalExtractionPerCycle(
				source,
				creep,
			);
			if (capacityAdded >= neededCapacity) {
				break;
			}
			creep.memory.targetSource = source.id;
			capacityAdded += extractionRate;
		}

		// If we still need more capacity, spawn new creeps
		neededCapacity -= capacityAdded;
		const room = source.room as BaseRoom;
		const harvesterBody = this.generateHarvesterBody(room, neededCapacity);
		const name = generateCreepName(ROLE_WORKER);
		room.addCreepToSpawnQueue(harvesterBody, ROLE_WORKER, {});
	}

	public generateHarvesterBody(room: BaseRoom, maxCapacity: number) {
		// Ratio of work and carry parts to move parts
		// Higher travel time vs harvest time?
		// harvest time will always be the same if the ratio of work to carry is the same
		// and can be calculated as work * HARVEST_POWER / CARRY_CAPACITY if need be

		// Guesstimate a good ratio for now
		const targetHarvestDepositTimeRatio = 0.5;

		// harvestTime is will always be the same assuming there's a 1:1 ratio of work to carry parts
		const harvestTime = HARVEST_POWER / CARRY_CAPACITY;

		// Calculate average
	}

	/**
	 * Removes excess harvesters from a source, starting with the biggest
	 * without going below the minimum required harvesters
	 * @param source (Source) The source to remove harvesters from
	 * @param minEnergy (number) The minimum energy to harvest from the source
	 */
	protected removeExcessHarvesters(source: Source, minEnergy: number) {
		const currentEstimate = this.getEstimatedSourceExtractionPerCycle(source);
		const excessCapacity = currentEstimate - minEnergy;
		const currentCreeps = this.getAssignedCreeps(source);
		// Sort creeps by extraction rate from greatest to least
		currentCreeps.sort(
			(a, b) =>
				this.calculateTotalExtractionPerCycle(source, b) -
				this.calculateTotalExtractionPerCycle(source, a),
		);

		let capacityRemoved = 0;
		for (const creep of currentCreeps) {
			const extractionRate = this.calculateTotalExtractionPerCycle(
				source,
				creep,
			);
			if (capacityRemoved + extractionRate > excessCapacity) {
				break;
			}
			creep.memory.targetSource = null;
			capacityRemoved += extractionRate;
		}
	}

	/**
	 * Get the estimated energy extraction from a source per regen cycle
	 * @param source (Source) The source to calculate the extraction rate for
	 * @returns (number) The estimated energy extraction per regen cycle
	 */
	public getEstimatedSourceExtractionPerCycle(source: Source) {
		const assignedCreeps = this.getAssignedCreeps(source);

		const extractionPerCycle = _.sumBy(assignedCreeps, (creep) =>
			this.calculateTotalExtractionPerCycle(source, creep),
		);

		return extractionPerCycle;
	}

	/**
	 * Get all the creeps assigned to a source
	 */
	public getAssignedCreeps(source: Source) {
		const workerCreeps = this.getCreepsByType(ROLE_WORKER) as WorkerCreep[];

		return _.filter(
			workerCreeps,
			(creep: WorkerCreep) => creep.memory.targetSource === source.id,
		);
	}

	protected getCreepsByType(type: CreepType): BaseCreep[] {
		return _.filter(
			Game.creeps,
			(creep: BaseCreep) => creep.memory.role === type,
		);
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
		const workParts = creep.body.filter((part) => part.type === WORK).length;
		const storageCapacity = creep.store.getCapacity();
		const extractionRate = workParts * HARVEST_POWER;
		const extractionTime = storageCapacity / extractionRate;

		return (
			storageCapacity / (extractionTime + this.getAverageDepositTime(source))
		);
	}

	public getAverageDepositTime(source: Source) {
		return _.meanBy(this.memory._sourceDepositTimes[source.id], "time");
	}

	/**
	 * Add a new deposit time to the source's history.
	 * If the history is longer than HISTORY_LENGTH, remove the oldest entries.
	 * @param source (Source) The source to add a deposit time for
	 * @param time (number) The time taken to deposit the energy
	 * @param amount (number) The amount of energy deposited
	 */
	public addSourceDepositTime(source: Source, time: number, amount: number) {
		this.memory._sourceDepositTimes[source.id].unshift({ time, amount });
		while (this.memory._sourceDepositTimes[source.id].length > HISTORY_LENGTH) {
			this.memory._sourceDepositTimes[source.id].pop();
		}
	}

	public memory: AllocatorMemory = Memory.allocator;
}
