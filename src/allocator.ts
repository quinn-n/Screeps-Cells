import _ from "lodash";
import HarvesterAllocator from "./allocator.harvester";
import UpgraderAllocator from "./allocator.upgrader";
import { getCreepsByRole } from "./creep";
import { BaseRoom } from "./room";
import { ROLE_WORKER_CREEP } from "./creep.types";
import type { WorkerCreep } from "./creep.worker";
import type { BaseCreep } from "./creep.base";
import BaseAllocator from "./allocator.base";

export function allocateCreeps() {
	/*
	Allocate workers in the following order:
	  - Harvesters
	  - Repair
	  - Constructors
	  - Upgraders
	*/
	for (const room of Object.values(Game.rooms)) {
		const controller = room.controller;

		if (controller === undefined) {
			continue;
		}

		const baseRoom = BaseRoom.fromRoom(room);
		if (controller.my) {
			const harvesterAllocator = new HarvesterAllocator();
			const harvestRatio = (2 * (controller.level ?? 0)) / 8;
			const success = harvesterAllocator.allocateCreeps(baseRoom, harvestRatio);

			// If failed to allocate any harvesters, clear all worker creep tasks and retry.
			if (!success) {
				const localWorkCreeps = _.filter(
					getCreepsByRole(ROLE_WORKER_CREEP) as WorkerCreep[],
					(creep) => {
						return creep.room.name === baseRoom.name;
					},
				);

				for (const creep of localWorkCreeps) {
					creep.targetTask = undefined;
				}
				harvesterAllocator.allocateCreeps(baseRoom, harvestRatio);
			}

			const upgraderAllocator = new UpgraderAllocator();
			upgraderAllocator.allocateCreeps(baseRoom);
		}
	}
}

/**
 * Add a new deposit time to the source's history.
 * If the history is longer than HISTORY_LENGTH, remove the oldest entries.
 */
export function addSourceDepositTime(
	sourceId: Id<Source>,
	creep: BaseCreep,
	time: number,
) {
	const memory = Memory.allocator;
	if (memory._sourceDepositTimes[sourceId] === undefined) {
		memory._sourceDepositTimes[sourceId] = [];
	}

	const workMoveRatio =
		creep.body.filter((part) => part.type === WORK).length /
		creep.body.filter((part) => part.type === MOVE).length;

	memory._sourceDepositTimes[sourceId].unshift({
		time,
		workMoveRatio,
	});
	while (
		memory._sourceDepositTimes[sourceId].length > BaseAllocator.HISTORY_LENGTH
	) {
		memory._sourceDepositTimes[sourceId].pop();
	}
}
