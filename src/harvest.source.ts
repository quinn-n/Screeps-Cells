import type { BuildingID, RoomID } from "./typedefs";

const cellConfig = require("./config.cell");
const _ = require("lodash");

const EXCLUDED_SOURCES: BuildingID[] = [
];

//Harvests source and manages how many creeps are assigned to each source
function harvestSource(creep: Creep) {
    if (creep.memory.targetSource) {
        const res = Game.getObjectById(creep.memory.targetSource);
        const err = creep.harvest(res);
        if (err === ERR_NOT_IN_RANGE) {
            creep.moveTo(res, {maxRooms: 1});
        }
        else if (err === ERR_NOT_ENOUGH_RESOURCES) {
            creep.memory.targetSource = getTargetResource(creep);
            if (creep.memory.targetSource) {
                harvestSource(creep);
            }
        }
        else if (err !== OK) {
            console.log(`harvestSource got error ${err} with creep ${creep.name}`);
        }
    }
    else {
        creep.memory.targetSource = getTargetResource(creep);
        if (creep.memory.targetSource) {
            harvestSource(creep);
        }
    }
}

function harvestMineral(creep: Creep) {
    if (creep.memory.targetMineral) {
        const res = Game.getObjectById(creep.memory.targetMineral);
        const err = creep.harvest(res);
        if (err === ERR_NOT_IN_RANGE)
            creep.moveTo(res, {maxRooms: 1});
        if (err === ERR_NOT_ENOUGH_RESOURCES)
            creep.memory.targetMineral = getTargetMineral(creep);
    }
    else {
        creep.memory.targetMineral = getTargetMineral(creep);
    }
}

/*
Pulls energy from the nearest energy storage building
returns OK on success and ERR_INVALID_TARGET if not valid container can be found
*/
function pullFromStorage(creep: Creep, resource: ResourceConstant) {
    const structures = _.filter(creep.room.find(FIND_STRUCTURES), (structure) => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(structure.structureType) && structure.store[RESOURCE_ENERGY] > 0);
    if (!structures.length) {
        return ERR_INVALID_TARGET;
    }
    sortOnDist(creep, structures);
    let withdrawAmmout = creep.store.getFreeCapacity(resource);
    if (structures[0].store[resource] < withdrawAmmout) {
        withdrawAmmout = structures[0].store[resource];
    }
    const error = creep.withdraw(structures[0], resource, withdrawAmmout);
    if (error === ERR_NOT_IN_RANGE) {
        creep.moveTo(structures[0], {maxRooms: 1});
        return OK;
    }
    if (error === ERR_BUSY) {
        return ERR_BUSY;
    }
    if (error !== OK) {
        console.log(`harvest.source pullFromStorage error: ${error}`);
    }
    return OK;
}

function clearTarget(creep: Creep) {
    creep.memory.targetSource = "";
}

//Returns possible target sources by room
function getAvailableTargetResources(room: RoomID) {
    const nTargets = getnTargetSources(room);
    //Get sources as a list, excluding filtered sources
    const sources = [];
    for (const sid in nTargets) {
        if (EXCLUDED_SOURCES.includes(sid))
            continue;
        sources.push(Game.getObjectById(sid));
    }
    //Search for first source with an empty adjacent spot
    for (const s in sources) {
        const source = sources[s];
        const nSpaces = getEmptySpace(source);
        if (nTargets[source.id] < nSpaces) {
            return source.id;
        }
    }
    //console.log("Found no more free spaces.");
    return "";
}

/*
Picks up resources in the same room
returns OK if resources were found
returns ERR_INVALID_TARGET if no resources were found
*/
function pickupResource(creep: Creep) {
    //Filter out resources on the edge of the map
    const resources = _.filter(creep.room.find(FIND_DROPPED_RESOURCES), (resource) => resource.pos.y > 0 && resource.pos.y < 49 && resource.pos.x > 0 && resource.pos.x < 49 && resource.resourceType === RESOURCE_ENERGY);
    if (!resources.length) {
        return ERR_INVALID_TARGET;
    }
    if (creep.pickup(resources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(resources[0], {maxRooms: 1});
    }
    return OK;
}

/*
Picks up tombstones in the same room
returns OK if a tombstone were found
returns ERR_INVALID_TARGET if no tombstone was found
*/
function pickupTombstone(creep: Creep) {
    const tombstones = creep.room.find(FIND_TOMBSTONES);
    if (!tombstones.length) {
        return ERR_INVALID_TARGET;
    }
    //Find a non-empty tombstone
    let tombstone: Tombstone;
    for (const t in tombstones) {
        tombstone = tombstones[t];
        if (tombstone.store[RESOURCE_ENERGY] > 0) {
            break;
        }
    }
    if (tombstone.store[RESOURCE_ENERGY] === 0) {
        console.log("Got zero energy tombstone.");
    }
    let amount = creep.store.getFreeCapacity(RESOURCE_ENERGY);
    if (tombstone.store[RESOURCE_ENERGY] < amount) {
        amount = tombstone.store[RESOURCE_ENERGY];
    }
    const error = creep.withdraw(tombstone, RESOURCE_ENERGY, amount);
    if (error === ERR_NOT_IN_RANGE) {
        creep.moveTo(tombstones[0], {maxRooms: 1});
    }
    else if (error !== OK) {
        console.log(`creep.withdraw got error ${error}`);
        console.log(`tombstone: ${tombstones[0]}`);
    }
    return OK;
}

/*
deposits resources in nearest container by order of priority in config.creeps
*/
function depositResources(creep: Creep, res: ResourceConstant = RESOURCE_ENERGY) {
    if (creep.memory.home === undefined) {
        console.log(`Creep ${creep.name} got undefined room.`);
    }
    const configCreep = cellConfig[creep.memory.home][creep.memory.role];
    for (const sType in configCreep.DEPOSIT_STRUCTURES) {
        const structureType = configCreep.DEPOSIT_STRUCTURES[sType];
        const structures = _.filter(creep.room.find(FIND_STRUCTURES), (structure) => structure.structureType === structureType && structure.store.getFreeCapacity(res) > 0);
        /*
        if (creep.memory.role === "mineralHarvester") {
            console.log("mineralHarvester in room " + creep.room.name + " got " + structures.length + " structures.");
        }
        */
        if (!structures.length) {
            continue;
        }
        const nearestStructure = getNearest(creep, structures);
        const err = creep.transfer(nearestStructure, res);
        if (err === ERR_NOT_IN_RANGE) {
            creep.moveTo(nearestStructure, {maxRooms: 1});
            return OK;
        }
        if (err !== OK) {
            console.log(`depositResources got error ${err} with creep ${creep.name} in room ${creep.room.name}`);
        }
        return OK;
    }
    return ERR_INVALID_TARGET;
}


//Returns a new target source for a creep
function getTargetResource(creep: Creep) {
    const nTargets = getnTargetSources(creep.room);
    //Get sources as a list, excluding filtered sources
    const sources = [];
    for (const sid in nTargets) {
        if (EXCLUDED_SOURCES.includes(sid))
            continue;
        sources.push(Game.getObjectById(sid));
    }
    //Sort sources by distance to creep
    sortOnDist(creep, sources);
    //Search for first source with an empty adjacent spot
    for (const s in sources) {
        const source = sources[s];
        const nSpaces = getEmptySpace(source);
        if (nTargets[source.id] < nSpaces) {
            return source.id;
        }
    }
    //console.log("Found no more free spaces.");
    return "";
}

//Returns a map containing the number of creeps that have targeted each source in the same room
function getnTargetSources(room: Room) {
    //Setup map
    const nTargets = {};
    const sources = room.find(FIND_SOURCES_ACTIVE);
    for (const s in sources) {
        const source = sources[s];
        nTargets[source.id] = 0;
    }
    for (const c in Game.creeps) {
        const creep = Game.creeps[c];
        const tgtSource = creep.memory.targetSource;
        //Ignore creeps that don't use targeted sources
        if (tgtSource === "" || tgtSource === undefined || tgtSource === -1)
            continue;
        if (nTargets[tgtSource] === undefined)
            continue;
        nTargets[tgtSource]++;
    }
    return nTargets;
}

function getTargetMineral(creep: Creep) {
}

//Returns a map containing the number of creeps that have targeted each mineral in a given room
function getnTargetMinerals(room: Room) {
    const nTargets = {};
    const minerals = room.find(FIND_MINERALS);
    for (const m in minerals) {
        const mineral = minerals[m];
        nTargets[mineral.id] = 0;
    }
    for (const c in Game.creeps) {
        const creep = Game.creeps[c];
        const tgtMineral = creep.memory.targetMineral;
        //Ignore creeps that don't use target minerals
        if (tgtMineral === "" || tgtMineral === undefined || tgtMineral === -1)
            continue;
        if (nTargets[tgtMineral] === undefined)
            continue;
        nTargets[tgtMineral]++;
    }
    return nTargets;
}

//Returns the number of empty spaces adjacent to a source
function getEmptySpace(source: Source) {
    const terrain = source.room.getTerrain();
    let nEmpty = 9;
    for (let x = source.pos.x - 1; x <= source.pos.x + 1; x++) {
        for (let y = source.pos.y - 1; y <= source.pos.y + 1; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                nEmpty--;
            }
        }
    }
    return nEmpty;
}

//Sorts sources based on their distance to the creep as the crow flies
function sortOnDist(creep: Creep, sources: Source[]) {
    //Find distance to each individual source
    for (const source of sources) {
        source.dist = dist(source.pos, creep.pos);
    }
    //Perform bubble sort on sources
    for (let n = 0; n < sources.length; n++) {
        for (let i = 0; i < sources.length - n - 1; i++) {
            if (sources[i].dist > sources[i + 1].dist) {
                swap(sources, i, i + 1);
            }
        }
    }
}

//Swaps two elements in a list
function swap<T>(list: T[], p1: number, p2: number) {
    const cache = list[p1];
    list[p1] = list[p2];
    list[p2] = cache;
}

//Returns the nearest structure to the creep
function getNearest(creep: Creep, structures: Structure[]) {
    let nearestStructure = structures[0];
    for (let i = 1; i < structures.length; i++) {
        const structure = structures[i];
        if (dist(creep.pos, structure.pos) < dist(creep.pos, nearestStructure.pos)) {
            nearestStructure = structure;
        }
    }
    return nearestStructure;
}

//Returns the linear distance between pos1 and pos2
function dist(pos1: RoomPosition, pos2: RoomPosition) {
    const xDist = pos1.x - pos2.x;
    const yDist = pos1.y - pos2.y;
    return Math.sqrt(xDist ** 2 + yDist ** 2);
}

module.exports = {
    harvestSource,
    harvestMineral,
    pullFromStorage,
    clearTarget,
    pickupResource,
    pickupTombstone,
    depositResources,
};

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
