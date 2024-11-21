/*
role.repair.js
Functions to manage repair creeps
*/

import type { HarvestingCreep } from "./types";

import _ from "lodash";
import harvestSource from "./harvest.source";
import utilityCreep from "./utility.creep";

/*
Repairs structures in the creep's room
*/
function run(creep: HarvestingCreep) {
	if (!creep.store[RESOURCE_ENERGY]) {
		creep.memory.harvesting = true;
	} else if (!creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
		creep.memory.harvesting = false;
	}

	if (!creep.memory.harvesting) {
		harvestSource.clearTarget(creep);
		const structures = _.filter(
			creep.room.find(FIND_STRUCTURES),
			(structure: Structure) => structure.hits < structure.hitsMax,
		);
		for (const structure of structures) {
			const repairErr = creep.repair(structure);
			if (repairErr === OK) {
				return OK;
			}
			if (repairErr === ERR_NOT_IN_RANGE) {
				const moveErr = creep.moveTo(structure, { maxRooms: 1 });
				if (moveErr === ERR_NO_PATH) {
					console.log(
						`Got no path to structure ${structure.structureType} at ${structure.pos}`,
					);
					continue;
				}
				return OK;
			}
		}
		utilityCreep.park(creep);
		creep.memory.harvesting = true;
	} else {
		harvestSource.harvestSource(creep);
		if (!creep.memory.targetSource) {
			const storageErr = harvestSource.pullFromStorage(creep, RESOURCE_ENERGY);
			if (storageErr !== OK) {
				utilityCreep.park(creep);
				creep.memory.harvesting = false;
			}
		}
	}
}

export default { run };
