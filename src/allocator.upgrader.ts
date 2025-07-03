import _ from "lodash";
import BaseAllocator from "./allocator.base";
import { ROLE_WORKER_CREEP, WORKER_TASK_UPGRADING } from "./creep.types";
import type { BaseRoom } from "./room";
import { generateCreepName } from "./creep.base";
import { mean } from "./misc";

export default class UpgraderAllocator extends BaseAllocator {
	/**
	 * Allocate upgraders to a room based on the room's energy production
	 * @param room
	 */
	public allocateCreeps(room: BaseRoom) {
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
	 * Generates a body for an upgrader that can upgrade the controller at a given capacity
	 * @param room
	 * @param capacity
	 */
	public generateUpgraderBody(room: BaseRoom, capacity: number) {
		const UPGRADER_SEGMENT = [WORK, MOVE, CARRY];

		// Find the number of segments needed to meet demand
		const upgradeTime = CARRY_CAPACITY / UPGRADE_CONTROLLER_POWER;
		const collectionTime = this.getAverageCollectionTime(room);
		// Number of harvests per segment cycle can be done per regen
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
}
