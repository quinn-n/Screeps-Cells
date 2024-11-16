
/*
role.repair.js
Functions to manage repair creeps
*/

const _ = require("lodash");
const harvestSource = require("./harvest.source");
const utilityCreep = require("./utility.creep");

/*
Repairs structures in the creep's room
*/
function run(creep: Creep) {
    if (!creep.store[RESOURCE_ENERGY]) {
        creep.memory.harvesting = true;
    }
    else if (!creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
        creep.memory.harvesting = false;
    }

    if (!creep.memory.harvesting) {
        harvestSource.clearTarget(creep);
        const structures = _.filter(creep.room.find(FIND_STRUCTURES), (structure) => structure.hits < structure.hitsMax);
        for (const structure of structures) {
            const repairErr = creep.repair(structure);
            if (repairErr === OK) {
                return OK;
            }
            if (repairErr === ERR_NOT_IN_RANGE) {
                const moveErr = creep.moveTo(structure, {maxRooms: 1});
                if (moveErr === ERR_NO_PATH) {
                    console.log(`Got no path to structure ${structure.structureType} at ${structure.pos}`);
                    continue;
                }
                return OK;
            }
        }
        utilityCreep.park(creep);
        creep.memory.harvesting = true;
    }
    else {
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

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
