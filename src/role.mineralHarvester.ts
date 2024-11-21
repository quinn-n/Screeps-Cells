/*
role.mineralHarvester.js
Functions to manage mineral harvesting creeps
*/

const harvestSource = require("./harvest.source");
const utilityCreep = require("./utility.creep");

function run(creep: Creep) {
	if (!creep.store.getFreeCapacity()) {
		creep.memory.harvesting = false;
	} else if (creep.store.getFreeCapacity() === creep.store.getCapacity()) {
		creep.memory.harvesting = true;
	}

	if (!creep.memory.harvesting) {
		const err = harvestSource.depositResources(creep, getMineral(creep));
		if (err !== OK) {
			creep.memory.harvesting = true;
			utilityCreep.park(creep);
		}
		return;
	}
	const resources = creep.room.find(FIND_MINERALS);
	if (!resources.length) {
		creep.memory.harvesting = false;
		utilityCreep.park(creep);
		return;
	}
	const resource = resources[0];
	const harvestErr = creep.harvest(resource);
	if (harvestErr === ERR_NOT_IN_RANGE) {
		creep.moveTo(resource, { maxRooms: 1 });
		return;
	}
	if (harvestErr === OK || harvestErr === ERR_TIRED) {
		return;
	}
}

/*
Returns the first resource type that the harvester has in storage
*/
function getMineral(creep: Creep) {
	for (const resource of RESOURCES_ALL) {
		if (creep.store[resource] > 0) {
			return resource;
		}
	}
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
