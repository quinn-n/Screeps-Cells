
/*
role.logistics.js
Functions to manage logistics robots
*/

const _ = require("lodash");
const cellConfig = require("./config.cell");

function run(creep: Creep) {
    const logisConfig = cellConfig[creep.room.name][creep.memory.role];
    for (const resource in logisConfig.TRANSFERS) {
        const transCfg = logisConfig.TRANSFERS[resource];
        const toStructures = getToStructures(creep, resource as ResourceConstant);
        if (!toStructures.length) {
            continue;
        }
        const fromStructures = getFromStructures(creep, resource);
        if (!fromStructures.length && !creep.store[resource as ResourceConstant]) {
            continue;
        }
        //Deposit resource
        if (creep.store[resource as ResourceConstant]) {
            //var structure = getLowestStored(toStructures, resource);
            const structure = getClosest(creep, toStructures);
            let amount = creep.store[resource as ResourceConstant];
            if (structure.store.getFreeCapacity(resource) < amount) {
                amount = structure.store.getFreeCapacity(resource);
            }
            const transferErr = creep.transfer(structure, resource as ResourceConstant, amount);
            if (transferErr === ERR_NOT_IN_RANGE) {
                creep.moveTo(structure, {maxRooms: 1});
                return;
            }
            if (transferErr === OK) {
                return;
            }
        }
        //Withdraw resource
        else {
            //var structure = getHighestStored(fromStructures, resource);
            const structure = getClosest(creep, _.filter(fromStructures, (structure) => structure.store[resource] > 0));
            let amount = creep.store.getFreeCapacity(resource as ResourceConstant);
            if (structure.store[resource] < amount) {
                amount = structure.store[resource];
            }
            const withdrawlErr = creep.withdraw(structure, resource as ResourceConstant, amount);
            if (withdrawlErr === ERR_NOT_IN_RANGE) {
                creep.moveTo(structure, {maxRooms: 1});
                return;
            }
            if (withdrawlErr === OK) {
                return;
            }
        }
    }
}


/*
Returns structures that need a certain type of resource
*/
function getToStructures(creep: Creep, resource: ResourceConstant) {
    const resCfg = cellConfig[creep.room.name][creep.memory.role].TRANSFERS[resource];
    let toStructures = _.filter(creep.room.find(FIND_MY_STRUCTURES), (structure) => resCfg.TO.includes(structure.structureType));
    if (!resCfg.AMOUNT) {
        toStructures = _.filter(toStructures, (structure) => structure.store.getFreeCapacity(resource) > 0);
    }
    else {
        toStructures = _.filter(toStructures, (structure) => structure.store[resource] < resCfg.AMOUNT);
    }
    return toStructures;
}

/*
Returns structures that can provide a certain type of resource
*/
function getFromStructures(creep: Creep, resource: ResourceConstant) {
    const resCfg = cellConfig[creep.room.name][creep.memory.role].TRANSFERS[resource];
    const fromStructures = _.filter(creep.room.find(FIND_MY_STRUCTURES), (structure) => resCfg.FROM.includes(structure.structureType) && structure.store[resource] > 0);
    return fromStructures;
}

/*
Returns the entity with the lowest store of a given resource
*/
function getLowestStored(objs: Structure[], resource: ResourceConstant) {
    let lowest = objs[0];
    for (let i = 1; i < objs.length; i++) {
        if (objs[i].store[resource] < lowest.store[resource]) {
            lowest = objs[i];
        }
    }
    return lowest;
}

/*
Returns the entity with the highest store of a given resource
*/
function getHighestStored(objs: Structure[], resource: ResourceConstant) {
    let highest = objs[0];
    for (let i = 1; i < objs.length; i++) {
        if (objs[i].store[resource] < highest.store[resource]) {
            highest = objs[i];
        }
    }
    return highest;
}
/*
Returns the nearest object to a creep
*/
function getClosest(creep: Creep, objs: Structure[]) {
    let closest = objs[0];
    for (let i = 1; i < objs.length; i++) {
        if (dist(objs[i].pos, creep.pos) < dist(closest.pos, creep.pos)) {
            closest = objs[i];
        }
    }
    return closest;
}

/*
Returns the distance between two positions
*/
function dist(p1: RoomPosition, p2: RoomPosition) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
