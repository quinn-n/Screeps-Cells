/**
 * @module role.spawn
 * Controls spawns in a room
 */

const _ = require("lodash");

const misc = require("./misc");

const cellConfig = require("./config.cell");

import type { RoomID, Segment } from "./types";
import type { CreepType } from "./role.room";

/**
 * Spawns a creep of a given type in a given room.
 * @param {string} roomID
 * @param {string} type - TODO: Make this an enum based on the available roles in `role.room.js`
 * @returns {number} OK on success, ERR_BUSY if all spawns are busy, ERR_NOT_ENOUGH_ENERGY if there is not enough energy to spawn the creep
 */
function spawnCreep(roomID: RoomID, type: CreepType) {
    const room = Game.rooms[roomID];

    const freeSpawns = _.filter(
        room.find(FIND_MY_STRUCTURES),
        (structure: Structure) =>
            structure.structureType === STRUCTURE_SPAWN &&
            !(structure as StructureSpawn).spawning &&
            structure.isActive(),
    );

    if (!freeSpawns.length) {
        return ERR_BUSY;
    }

    // freeSpawns is guaranteed to only contain StructureSpawns because of the filter above
    const spawn = freeSpawns[0] as StructureSpawn;

    const creepConfig = cellConfig[roomID].SPAWN[type];
    if (!creepConfig) {
        console.log(`No configuration for creep type ${type} in room ${roomID}`);
        return ERR_INVALID_ARGS;
    }
    let body: BodyPartConstant[];
    if (!creepConfig.AUTO_EXPAND) {
        body = createBody(creepConfig.SEGMENT, 1);
    } else {
        const nSegments = Math.floor(
            room.energyAvailable / calcSegmentCost(creepConfig.SEGMENT),
        );
        console.log(
            `Room has ${room.energyAvailable} energy available and segments cost ${calcSegmentCost(creepConfig.SEGMENT)}`,
        );

        if (!nSegments) {
            return ERR_NOT_ENOUGH_ENERGY;
        }

        body = createBody(creepConfig.SEGMENT, nSegments);
    }

    console.log(`Attempting to create creep with size: ${body.length}`);
    console.log(`and body: ${misc.arrayToString(body)}`);

    if (body.length >= MAX_CREEP_SIZE) {
        console.log(`Body length greater than max creep size: ${body.length}`);
    }

    console.log(`Spawning ${type}${Game.time}`);

    const err = spawn.spawnCreep(body, type + Game.time, {
        memory: {
            role: type,
            home: spawn.room.name,
            room: spawn.room.name,
            spawner: spawn.id,
            toRecycle: false,
        },
    });

    if (err  !==  OK) {
        console.log(`role.spawn.js got error: ${err}`);
        return err;
    }
    return OK;
}


/**
 * @param {Segment} segment Creep segment
 * @returns {number} The cost of a segment
 */
function calcSegmentCost(segment: Segment) {
    let total = 0;
    for (const type in segment) {
        // biome-ignore lint/style/noNonNullAssertion: `type` keys are pulled from `segment`, so they are guaranteed to be valid
        const n = segment[type as BodyPartConstant]!;
        total += BODYPART_COST[type as BodyPartConstant] * n;
    }
    return total;
}

/**
 * Generates a creep body with a given number of segments.
 * If the body would exceed the maximum creep size, the body is truncated.
 * @param {Segment} segment
 * @param {number} nSegments
 * @returns {BodyPartConstant[]} An array of body part strings
 */
function createBody(segment: Segment, nSegments: number) {
    const body: BodyPartConstant[] = [];
    const maxSegments = Math.floor(MAX_CREEP_SIZE / segmentLength(segment));
    const reducedNSegments = (nSegments < maxSegments) ? nSegments : maxSegments;

    for (let i = 0; i < reducedNSegments; i++) {
        for (const part in segment) {
            // biome-ignore lint/style/noNonNullAssertion: `seg` keys are pulled from `segment`, so they are guaranteed to be valid
            const nParts = segment[part as BodyPartConstant]!;
            for (let j = 0; j < nParts; j++) {
                body.push(part as BodyPartConstant);
            }
        }
    }
    return body.sort().reverse();
}

/**
 *
 * @param {Segment} segment
 * @returns {number} Returns the length of a segment
 */
function segmentLength(segment: Segment) {
    let sum = 0;
    for (const seg in segment) {
        // biome-ignore lint/style/noNonNullAssertion: `seg` keys are pulled from `segment`, so they are guaranteed to be valid
        sum += segment[seg as BodyPartConstant]!;
    }
    return sum;
}

module.exports = { spawnCreep };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
