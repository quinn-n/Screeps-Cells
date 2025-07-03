import _ from "lodash";
import cleanup from "./cleanup";
import { createCreepInstance, getCreepsByRole } from "./creep";
import pixelGenerator from "./pixel.generator";
import { BaseRoom } from "./room";
import UpgraderAllocator from "./allocator.upgrader";
import { ROLE_WORKER_CREEP } from "./creep.types";
import type { WorkerCreep } from "./creep.worker";
import HarvesterAllocator from "./allocator.harvester";

function loop() {
	cleanup.run();

	allocateCreeps();
	tickRooms();
	tickCreeps();

	// pixelGenerator.run();
}

function tickRooms() {
	for (const room of Object.values(Game.rooms).map((room) =>
		BaseRoom.fromRoom(room),
	)) {
		if (room.controller?.my) {
			room.tick();
		}
	}
}

function tickCreeps() {
	for (const creep of Object.values(Game.creeps).map((creep) =>
		createCreepInstance(creep),
	)) {
		if (creep.spawning) {
			continue;
		}

		creep.tick();
	}
}

function allocateCreeps() {
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

// Make sure the game can find the loop function
module.exports = { loop };
