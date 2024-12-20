/*
role.harvester.js
Manages harvester creeps
*/

import type { HarvestingCreep } from "./types";

const harvestSource = require("./harvest.source");
const utilityCreep = require("./utility.creep");

function run(creep: HarvestingCreep) {
	if (!creep.store[RESOURCE_ENERGY]) {
		creep.memory.harvesting = true;
	} else if (!creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
		creep.memory.harvesting = false;
	}

	if (creep.memory.harvesting) {
		harvestSource.harvestSource(creep);
		if (!creep.memory.targetSource) {
			utilityCreep.park(creep);
			creep.memory.harvesting = false;
		}
	} else {
		harvestSource.clearTarget(creep);
		if (harvestSource.depositResources(creep) !== OK) {
			// Upgrade controller if there is nowhere else to deposit energy
			const controller = creep.room.controller;
			if (controller === undefined) {
				console.log(`No controller in room ${creep.room.name}`);
				return;
			}
			const err = creep.upgradeController(controller);
			if (err === ERR_NOT_IN_RANGE) {
				creep.moveTo(controller, { maxRooms: 1 });
			}
		}
	}
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
