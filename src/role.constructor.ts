/*
role.constructor.js
Functions to manage construction creeps
*/

import type { HarvestingCreep } from "./types";

const _ = require("lodash");
const harvestSource = require("./harvest.source");
const utilityCreep = require("./utility.creep");

function run(creep: HarvestingCreep) {
	if (!creep.store[RESOURCE_ENERGY]) {
		creep.memory.harvesting = true;
	} else if (!creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
		creep.memory.harvesting = false;
	}

	if (!creep.memory.harvesting) {
		harvestSource.clearTarget(creep);
		const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
		for (const s in sites) {
			const site = sites[s];
			const buildErr = creep.build(site);
			if (buildErr === ERR_NOT_IN_RANGE) {
				const moveErr = creep.moveTo(site, { maxRooms: 1 });
				if (moveErr === ERR_NO_PATH) {
					console.log(`No path to construction site at ${site.pos}`);
					continue;
				}
				return OK;
			}
			if (buildErr === OK) {
				return OK;
			}
		}
		//If no structures can be built, repair
		const repairErr = repair(creep);
		if (repairErr !== OK) {
			creep.memory.harvesting = true;
			utilityCreep.park(creep);
		} else {
			return;
		}
	} else {
		harvestSource.harvestSource(creep);
		if (!creep.memory.targetSource) {
			const err = harvestSource.pullFromStorage(creep, RESOURCE_ENERGY);
			if (err !== OK) {
				utilityCreep.park(creep);
				creep.memory.harvesting = false;
			}
		}
	}
}

/*
Repairs structures in the creep's room
*/
function repair(creep: Creep) {
	const structures = _.filter(
		creep.room.find(FIND_STRUCTURES),
		(structure: Structure) =>
			structure.hits < structure.hitsMax &&
			structure.structureType !== STRUCTURE_WALL,
	);
	for (const s in structures) {
		const structure = structures[s];
		const repairErr = creep.repair(structure);
		if (repairErr === OK) {
			return OK;
		}
		if (repairErr === ERR_NOT_IN_RANGE) {
			const moveErr = creep.moveTo(structure, { maxRooms: 1 });
			if (moveErr === ERR_NO_PATH) {
				console.log(
					`Got no path to structure ${structure.structureType} at ${structure.pos} in room ${creep.room.name}`,
				);
				continue;
			}
			return OK;
		}
	}
	return ERR_NOT_FOUND;
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
