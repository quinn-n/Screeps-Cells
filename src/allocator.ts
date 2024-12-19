import { type BaseCreep, generateCreepName } from "./creep.base";
import type { CreepType } from "./creep.types";
import {
	ROLE_WORKER,
	WORKER_TASK_HARVESTING,
	type WorkerCreep,
} from "./creep.worker";
import type { BaseRoom } from "./room";
import type { Ticker } from "./ticker";

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

export default class Allocator implements Ticker {
	public tick() {
		for (const room of Object.values(Game.rooms) as BaseRoom[]) {
			const controller = room.controller;
			// If there's no controller, this isn't my room.
			if (controller === undefined || controller.my === false) {
				return;
			}
			// Scale up the energy harvested based on the controller level
			const harvestRatio = Math.min(controller.level / 4, 1);
			this.allocateHarvesters(room, harvestRatio);
		}
	}

	private constructor() {}

	/**
	 * Allocates the right number of harvesters to each source in a room
	 * @param harvestRatio (number) How much energy to harvest from each source from 0 to 1
	 */
	public allocateHarvesters(room: BaseRoom, harvestRatio: number) {
		const sources = room.find(FIND_SOURCES);
		for (const source of sources) {
			const energyToHarvest = source.energyCapacity * harvestRatio;
			this.removeExcessHarvesters(source, energyToHarvest);
			this.addRequiredHarvesters(source, energyToHarvest);
		}
	}

	/**
	 * Adds harvesters to a source until the estimated energy extraction per cycle.
	 * Pulls from unused creeps first, then spawns largest creeps possible.
	 */
	public addRequiredHarvesters(source: Source, minEnergy: number) {
		const room = source.room as BaseRoom;

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
		const harvesterBody = this.generateHarvesterBody(
			source,
			neededCapacity / ENERGY_REGEN_TIME,
		);
		const name = generateCreepName(ROLE_WORKER);
		room.addCreepToSpawnQueue(harvesterBody, ROLE_WORKER, {
			memory: {
				role: ROLE_WORKER,
				targetSource: source.id,
				targetTask: WORKER_TASK_HARVESTING,
			},
		});
	}

	/**
	 * Generates a body for a harvester that can extract maxCapacity energy per tick on average from a source.
	 * If the body is too large for MAX_CREEP_SIZE, or too expensive for the room's energy capacity, it will be capped.
	 * @param source (Source) The source to generate the body for
	 * @param maxCapacity (number) The maximum energy to extract from the source per tick
	 * @returns (BodyPartConstant[]) The body for the harvester
	 */
	public generateHarvesterBody(source: Source, maxCapacity: number) {
		// Guesstimate a good ratio for now; there is likely an optimal ratio
		// for energy extracted per creep vs energy cost of said creep
		// when considering the cost of (WORK + CARRY) vs (MOVE) parts
		// but that's a problem for another day. This 1:1 ratio is "good enough" and easy to tweak by eye.
		const targetHarvestDepositTimeRatio = 1;

		// harvestTime is will always be the same assuming there's a 1:1 ratio of work to carry parts
		const harvestTime = HARVEST_POWER / CARRY_CAPACITY;

		// (n / x) + b
		const depositTimeToMoveRatioFcn = this.getMoveRatioFromTimeFunction(
			source.id,
		);

		const targetDepositTime = harvestTime / targetHarvestDepositTimeRatio;
		// Round to the nearest power of 2 (including negative powers)
		// because you can't add less than 1 move part to a creep
		const targetMoveRatio = depositTimeToMoveRatioFcn(targetDepositTime);
		const roundedMoveRatio = roundToPowerOfTwo(targetMoveRatio);
		// Cap move ratio at 2, as this will result in creeps with 1:1 work:move parts which will move at max speed
		// (except on swamp. Might be worth considering in the future.)
		const cappedMoveRatio = Math.min(roundedMoveRatio, 2);

		// TODO: Use updated deposit time calculated from inverse depositTimeToMoveRatioFcn to account for rounding.
		const calculatedDepositTime = targetDepositTime;
		const segmentExtractionPerTick =
			CARRY_CAPACITY / (harvestTime + calculatedDepositTime);

		// Get the number of work segments needed to extract maxCapacity per tick
		// maxCapacity / segmentExtractionPerTick * parts per segment ([WORK, CARRY])
		const maxWorkSegmentsNeededForExtraction =
			Math.ceil(maxCapacity / segmentExtractionPerTick) * 2;

		// Get max possible work segments for a maximum size creep
		// See notebook for math work again
		const maxWorkSegmentsForSizeLimit = Math.floor(
			MAX_CREEP_SIZE / (cappedMoveRatio + 2),
		);

		// Get max possible work segments for a maximum cost creep
		// Same math as above but with energy cost instead of size cost
		const costRatio =
			BODYPART_COST[MOVE] / (BODYPART_COST[WORK] + BODYPART_COST[CARRY]);
		const maxWorkSegmentsForCostLimit = Math.floor(
			source.room.energyCapacityAvailable / (costRatio + 2),
		);

		// Take the minimum of the three limits as the number of work segments to use
		const workSegments = Math.min(
			maxWorkSegmentsNeededForExtraction,
			maxWorkSegmentsForSizeLimit,
			maxWorkSegmentsForCostLimit,
		);

		const moveParts = workSegments * cappedMoveRatio;

		// Generate the body
		const body: BodyPartConstant[] = [];
		for (let i = 0; i < workSegments; i++) {
			body.push(WORK, CARRY);
		}
		for (let i = 0; i < moveParts; i++) {
			body.push(MOVE);
		}

		return body;
	}

	/**
	 * Returns a curve that maps the average ratio of work to carry parts to the time taken to harvest and deposit energy
	 * Uses the function ratio = (n / time) + offset
	 * @param source (Id<Source>) The source to generate the curve for
	 */
	private getMoveRatioFromTimeFunction(sourceId: Id<Source>) {
		const sourceDepositTimes = Array.from(
			this.memory._sourceDepositTimes[sourceId],
		);
		sourceDepositTimes.sort((a, b) => a.workMoveRatio - b.workMoveRatio);

		let meanOffset = 0;
		let meanAmplitude = 0;

		for (let i = 0; i < sourceDepositTimes.length - 1; i++) {
			const time = sourceDepositTimes[i].time;
			const nextTime = sourceDepositTimes[i + 1].time;
			const ratio = sourceDepositTimes[i].workMoveRatio;
			const nextRatio = sourceDepositTimes[i + 1].workMoveRatio;

			// This is a linear approximation of the curve. With enough data points, this should be good enough
			// See notebook for math behind these calculations
			const offset =
				(nextRatio * nextTime - ratio * time) / (nextRatio - ratio);
			const amplitude = time * (ratio - offset);

			meanOffset += offset;
			meanAmplitude += amplitude;
		}

		meanOffset /= sourceDepositTimes.length - 1;
		meanAmplitude /= sourceDepositTimes.length - 1;

		return (depositTime: number) => meanAmplitude / depositTime + meanOffset;
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
			(creep: Creep) => (creep as BaseCreep).memory.role === type,
		) as BaseCreep[];
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
		const workSegments = creep.body.filter((part) => part.type === WORK).length;
		const storageCapacity = creep.store.getCapacity();
		const extractionRate = workSegments * HARVEST_POWER;
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
	public addSourceDepositTime(
		source: Source,
		creep: BaseCreep,
		time: number,
		amount: number,
	) {
		const workMoveRatio =
			creep.body.filter((part) => part.type === WORK).length /
			creep.body.filter((part) => part.type === MOVE).length;

		this.memory._sourceDepositTimes[source.id].unshift({
			time,
			amount,
			workMoveRatio,
		});
		while (this.memory._sourceDepositTimes[source.id].length > HISTORY_LENGTH) {
			this.memory._sourceDepositTimes[source.id].pop();
		}
	}

	public memory: AllocatorMemory = Memory.allocator;

	/**
	 * Returns the singleton instance of the Allocator
	 */
	public static get Instance() {
		if (Allocator._instance === null) {
			Allocator._instance = new Allocator();
		}
		return Allocator._instance;
	}

	private static _instance: Allocator | null = null;
}

/**
 * Rounds a number to the nearest power of two
 * @param num (number) The number to round
 * @returns (number) The number rounded to the nearest power of two
 */
function roundToPowerOfTwo(num: number) {
	const log = Math.log2(num);
	const lower = 2 ** Math.floor(log);
	const upper = 2 ** Math.ceil(log);
	const mean = (lower + upper) / 2;
	return num >= mean ? upper : lower;
}
