
/*
role.upgrader.js
Manages controller upgrading creeps
*/

const harvestSource = require("./harvest.source");
const utilityCreep = require("./utility.creep");

function run(creep: Creep) {
    if (!creep.store[RESOURCE_ENERGY]) {
        creep.memory.harvesting = true;
    }
    else if (!creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
        creep.memory.harvesting = false;
    }

    if (!creep.memory.harvesting) {
        harvestSource.clearTarget(creep);
        const upgradeErr = creep.upgradeController(creep.room.controller);
        if (upgradeErr === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, {maxRooms: 1});
            return OK;
        }
    }
    else {
        harvestSource.harvestSource(creep);
        if (!creep.memory.targetSource) {
            creep.memory.harvesting = false;
            utilityCreep.park(creep);
        }
    }
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
