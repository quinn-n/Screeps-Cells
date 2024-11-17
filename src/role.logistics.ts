
/*
role.logistics.js
Functions to manage logistics robots
*/

import type { CellConfig } from "./config.cell";
import type { StorageStructure } from "./types";

const _ = require("lodash");
const cellConfig: CellConfig = require("./config.cell");

function run(creep: Creep) {
    const logisConfig = cellConfig[creep.room.name].logistics;
    for (const resourceString in logisConfig.TRANSFERS) {
        const resource = resourceString as ResourceConstant;
        const toStructures = getToStructures(creep, resource);
        if (!toStructures.length) {
            continue;
        }
        const fromStructures = getFromStructures(creep, resource);
        if (!fromStructures.length && !creep.store[resource]) {
            continue;
        }
        // Deposit resource
        if (creep.store[resource]) {
            const structure = getClosest(creep, toStructures);
            let amount = creep.store[resource];
            if (structure.store.getFreeCapacity(resource) < amount) {
                amount = structure.store.getFreeCapacity(resource);
            }
            const transferErr = creep.transfer(structure, resource, amount);
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
            const structure = getClosest(creep, _.filter(fromStructures, (structure: StorageStructure) => structure.store[resource] > 0) as StorageStructure[]);
            let amount = creep.store.getFreeCapacity(resource);
            if (structure.store[resource] < amount) {
                amount = structure.store[resource];
            }
            const withdrawlErr = creep.withdraw(structure, resource, amount);
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
    const resCfg = cellConfig[creep.room.name].logistics.TRANSFERS[resource];

    if (resCfg === undefined) {
        console.warn(`Got unconfigured resource ${resource} in room ${creep.room.name}`);
        return [];
    }

    let toStructures: StorageStructure[] = _.filter(creep.room.find(FIND_MY_STRUCTURES), (structure: Structure) => resCfg.TO.includes(structure.structureType));
    if (!resCfg.AMOUNT) {
        toStructures = _.filter(toStructures, (structure: StorageStructure) => structure.store.getFreeCapacity(resource) > 0);
    }
    else {
        toStructures = _.filter(toStructures, (structure: StorageStructure) => structure.store[resource] < resCfg.AMOUNT);
    }
    return toStructures;
}

/*
Returns structures that can provide a certain type of resource
*/
function getFromStructures(creep: Creep, resource: ResourceConstant) {
    const resCfg = cellConfig[creep.room.name].logistics.TRANSFERS[resource];
    if (resCfg === undefined) {
        throw new Error(`Got unconfigured resource ${resource} in room ${creep.room.name}`);
    }
    const fromStructures = _.filter(creep.room.find(FIND_MY_STRUCTURES), (structure: StorageStructure) => resCfg.FROM.includes(structure.structureType) && structure.store[resource] > 0) as StorageStructure[];
    return fromStructures;
}

/*
Returns the entity with the lowest store of a given resource
*/
function getLowestStored(objs: StorageStructure[], resource: ResourceConstant) {
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
function getHighestStored(objs: StorageStructure[], resource: ResourceConstant) {
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
function getClosest<T extends StructureConstant>(creep: Creep, objs: Structure<T>[]) {
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
