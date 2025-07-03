import _ from "lodash";
import BaseAllocator from "./allocator.base";
import { generateCreepName } from "./creep.base";
import { ROLE_WORKER_CREEP, WORKER_TASK_HARVESTING } from "./creep.types";
import type { WorkerCreep } from "./creep.worker";
import { BaseRoom } from "./room";
import { roundToPowerOfTwo } from "./misc";
import { getCreepsByRole } from "./creep";

export default class HarvesterAllocator extends BaseAllocator {
	public tick() {
		for (const room of Object.values(Game.rooms)) {
			const controller = room.controller;
			// If there's no controller, this isn't my room.
			if (controller === undefined || !controller.my) {
				return;
			}

			// Scale up the energy harvested based on the controller level
			const harvestRatio = Math.min(controller.level / 4, 1);
			this.allocateCreeps(BaseRoom.fromRoom(room), harvestRatio);
		}
	}

	/**
	 * Allocates the right number of harvesters to each source in a room
	 * @param harvestRatio (number) How much energy to harvest from each source from 0 to 1
	 * @returns (boolean) False if failed to allocate capacity when needed, otherwise true
	 */
	public allocateCreeps(room: Room, harvestRatio: number) {
		const sources = room.find(FIND_SOURCES);
		let success = false;
		for (const source of sources) {
			// TODO: Set energyToHarvest based on the room's energy demand.
			// to allow for harvesters to be reused for other tasks when storage is full.
			const energyToHarvest = source.energyCapacity * harvestRatio;
			this.removeExcessHarvesters(source, energyToHarvest);
			success ||= this.addRequiredHarvesters(source, energyToHarvest);
		}
		return success;
	}

	/**
	 * Adds harvesters to a source until the estimated energy extraction per cycle.
	 * Pulls from unused creeps first, then spawns largest creeps possible.
	 * @param source (Source) The source to add harvesters to
	 * @param minEnergy (number) The minimum energy to harvest from the source
	 * @returns (boolean) False if failed to allocate capacity when needed, otherwise true
	 */
	public addRequiredHarvesters(source: Source, minEnergy: number) {
		const room = BaseRoom.fromRoom(source.room);

		const currentEstimate = this.getEstimatedSourceExtractionPerCycle(
			source,
			WORKER_TASK_HARVESTING,
		);
		let neededCapacity = minEnergy - currentEstimate;

		const unusedCreeps = _.filter(
			getCreepsByRole(ROLE_WORKER_CREEP),
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
			// Failed to allocate capacity when needed
			if (capacityAdded === 0) {
				return false;
			}
			// Allocated capacity earlier despite not being able to spawn a new creep
			return true;
		}

		neededCapacity -= capacityAdded;
		if (neededCapacity <= 0) {
			return true;
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
		return true;
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
}
