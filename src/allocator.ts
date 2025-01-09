import { type BaseCreep, generateCreepName } from "./creep.base";
import {
	ROLE_WORKER_CREEP,
	WORKER_TASK_HARVESTING,
	WORKER_TASK_UPGRADING,
	type WorkerCreepTask,
	type CreepType,
} from "./creep.types";
import type { WorkerCreep } from "./creep.worker";
import { mean } from "./misc";
import { BaseRoom } from "./room";
import type { Ticker } from "./ticker";

import _ from "lodash";
import type { RoomID } from "./types";

interface DepositRecord {
	time: number;
	workMoveRatio: number;
}

const HISTORY_LENGTH = 5;

interface AllocatorMemory {
	/**
	 * Record of times taken for a harvester to deposit its energy and return to the source
	 */
	_sourceDepositTimes: Record<Id<Source>, DepositRecord[]>;
	_collectionTimes: Record<RoomID, number[]>;
}

export default class Allocator implements Ticker {
	public tick() {
		for (const room of Object.values(Game.rooms)) {
			const controller = room.controller;
			// If there's no controller, this isn't my room.
			if (controller === undefined || controller.my === false) {
				return;
			}
			// Scale up the energy harvested based on the controller level
			const harvestRatio = Math.min(controller.level / 4, 1);
			this.allocateHarvesters(room, harvestRatio);

			this.allocateUpgraders(BaseRoom.fromRoom(room));
		}
	}

	private constructor() {
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
	 * Allocates the right number of harvesters to each source in a room
	 * @param harvestRatio (number) How much energy to harvest from each source from 0 to 1
	 */
	public allocateHarvesters(room: Room, harvestRatio: number) {
		const sources = room.find(FIND_SOURCES);
		for (const source of sources) {
			// TODO: Set energyToHarvest based on the room's energy demand.
			// to allow for harvesters to be reused for other tasks when storage is full.
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
		const room = BaseRoom.fromRoom(source.room);

		const currentEstimate = this.getEstimatedSourceExtractionPerCycle(
			source,
			WORKER_TASK_HARVESTING,
		);
		let neededCapacity = minEnergy - currentEstimate;

		const unusedCreeps = _.filter(
			this.getCreepsByType(ROLE_WORKER_CREEP),
			(creep: WorkerCreep) => {
				return creep.targetTask === undefined;
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
			creep.targetTask = WORKER_TASK_HARVESTING;
			capacityAdded += extractionRate;
		}

		// If we still need more capacity, spawn new creeps

		// If there's already a worker in the spawn queue, don't add another
		if (room.hasRoleInSpawnQueue(ROLE_WORKER_CREEP)) {
			return;
		}

		neededCapacity -= capacityAdded;
		if (neededCapacity <= 0) {
			return;
		}

		const harvesterBody = this.generateHarvesterBody(
			source,
			neededCapacity / ENERGY_REGEN_TIME,
		);
		const name = generateCreepName(ROLE_WORKER_CREEP);
		console.log(
			`Requesting new harvester ${name} for source ${source.id} which needs ${neededCapacity} capacity.`,
		);
		room.addCreepToSpawnQueue(ROLE_WORKER_CREEP, harvesterBody, name, {
			memory: {
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
		// cost of work segments + cost of move segments * work to move ratio
		const maxWorkSegmentsForCostLimit = Math.floor(
			source.room.energyCapacityAvailable /
				(BODYPART_COST[WORK] +
					BODYPART_COST[CARRY] +
					BODYPART_COST[MOVE] * cappedMoveRatio),
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
		// If the source is new to the allocator, return a constant function that always returns 1.
		if (
			this.memory._sourceDepositTimes[sourceId] === undefined ||
			this.memory._sourceDepositTimes[sourceId].length === 0
		) {
			this.memory._sourceDepositTimes[sourceId] = [];
			return () => 1;
		}

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
		const currentEstimate = this.getEstimatedSourceExtractionPerCycle(
			source,
			WORKER_TASK_HARVESTING,
		);
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
			console.log(`Removing creep ${creep.name} from source ${source.id}`);
			creep.memory.targetSource = undefined;
			creep.targetTask = undefined;
			capacityRemoved += extractionRate;
		}
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
	 * Allocate upgraders to a room based on the room's energy production
	 * @param room
	 */
	public allocateUpgraders(room: BaseRoom) {
		// If there's already an upgrader in the spawn queue, don't add another
		if (room.hasRoleInSpawnQueue(ROLE_WORKER_CREEP)) {
			return;
		}

		const sources = room.find(FIND_SOURCES);
		const energyProductionPerCycle = _.sum(
			sources.map((source) =>
				this.getEstimatedSourceExtractionPerCycle(source),
			),
		);

		const energyConsumptionPerCycle = room.getEnergySpent();

		const energySurplusPerCycle =
			energyProductionPerCycle - energyConsumptionPerCycle;

		/*
		 * If the room is stockpiling energy, try to save 10% of the energy produced per cycle.
		 */
		const targetSurplusPerCycle = room.isStockpilingEnergy()
			? energyProductionPerCycle * 0.1
			: 0;

		const energyExpenditureNeeded =
			energySurplusPerCycle - targetSurplusPerCycle;

		const upgraderBody = this.generateUpgraderBody(
			room,
			energyExpenditureNeeded,
		);

		const name = generateCreepName(ROLE_WORKER_CREEP);
		room.addCreepToSpawnQueue(ROLE_WORKER_CREEP, upgraderBody, name, {
			memory: {
				targetTask: WORKER_TASK_UPGRADING,
			},
		});
	}

	/**
	 * Generates a body for an upgrader that can upgrade the controller at a given capacity
	 * @param room
	 * @param capacity
	 */
	public generateUpgraderBody(room: BaseRoom, capacity: number) {
		const UPGRADER_SEGMENT = [WORK, MOVE, CARRY];

		// Find the number of segments needed to meet demand
		const upgradeTime = CARRY_CAPACITY / UPGRADE_CONTROLLER_POWER;
		const collectionTime = this.getAverageCollectionTime(room);
		const harvestsPerCycle = Math.floor(
			ENERGY_REGEN_TIME / (upgradeTime + collectionTime),
		);
		const energyNeededPerHarvest = capacity / harvestsPerCycle;
		const segmentsNeeded = Math.ceil(energyNeededPerHarvest / CARRY_CAPACITY);
		console.log(`Need a creep with ${segmentsNeeded} segments`);

		// Find the maximum number of segments possible
		const maxSegmentsForSizeLimit = Math.floor(
			MAX_CREEP_SIZE / UPGRADER_SEGMENT.length,
		);
		const segmentEnergyCost = _.sum(
			UPGRADER_SEGMENT.map((part) => BODYPART_COST[part]),
		);
		const maxSegmentsForEnergyLimit = Math.floor(
			room.energyCapacityAvailable / segmentEnergyCost,
		);

		const maxSegments = Math.min(
			maxSegmentsForSizeLimit,
			maxSegmentsForEnergyLimit,
		);

		const nSegments = Math.min(segmentsNeeded, maxSegments);

		const body: BodyPartConstant[] = [];
		for (let i = 0; i < nSegments; i++) {
			body.push(...UPGRADER_SEGMENT);
		}
		return body;
	}

	/**
	 * Get all the creeps assigned to a source
	 */
	public getAssignedCreeps(source: Source, targetTask?: WorkerCreepTask) {
		const workerCreeps = this.getCreepsByType(
			ROLE_WORKER_CREEP,
		) as WorkerCreep[];

		return _.filter(workerCreeps, (creep: WorkerCreep) => {
			const hasMatchingTargetTask =
				targetTask === undefined || creep.targetTask === targetTask;

			return creep.memory.targetSource === source.id && hasMatchingTargetTask;
		});
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
		const storageCapacity = creep.store.getCapacity();
		const extractionTime = this.getExtractionTime(creep);

		return (
			storageCapacity / (extractionTime + this.getAverageDepositTime(source))
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
	 * Add a new deposit time to the source's history.
	 * If the history is longer than HISTORY_LENGTH, remove the oldest entries.
	 * @param source (Source) The source to add a deposit time for
	 * @param time (number) The time taken to deposit the energy
	 */
	public addSourceDepositTime(
		sourceId: Id<Source>,
		creep: BaseCreep,
		time: number,
	) {
		if (this.memory._sourceDepositTimes[sourceId] === undefined) {
			this.memory._sourceDepositTimes[sourceId] = [];
		}

		const workMoveRatio =
			creep.body.filter((part) => part.type === WORK).length /
			creep.body.filter((part) => part.type === MOVE).length;

		this.memory._sourceDepositTimes[sourceId].unshift({
			time,
			workMoveRatio,
		});
		while (this.memory._sourceDepositTimes[sourceId].length > HISTORY_LENGTH) {
			this.memory._sourceDepositTimes[sourceId].pop();
		}
	}

	/**
	 * Calculates the mean collection time for a given room
	 * @param room (BaseRoom) The room to calculate the collection time for
	 */
	public getAverageCollectionTime(room: BaseRoom) {
		if (
			this.memory._collectionTimes[room.name] === undefined ||
			this.memory._collectionTimes[room.name].length === 0
		) {
			return 1;
		}
		return mean(this.memory._collectionTimes[room.name]);
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
		while (this.memory._collectionTimes[room.name].length > HISTORY_LENGTH) {
			this.memory._collectionTimes[room.name].pop();
		}
	}

	public memory: AllocatorMemory;

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
