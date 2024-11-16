
/*
role.security.js
Functions to manage security creeps
*/

import type { CellConfig } from "./config.cell";
import type { BaseCreep } from "./types";

const cellConfig: CellConfig = require("./config.cell");

const HOSTILE_CREEP_PARTS: BodyPartConstant[] = [
    ATTACK,
    RANGED_ATTACK,
    CLAIM
];

function run(creep: BaseCreep) {
    const secCfg = cellConfig[creep.memory.home].security;

    //Attack hostile attack creeps
    const hostileCreeps = getAttackCreeps(creep);
    for (const hostileCreep of hostileCreeps) {
        const attackErr = creep.attack(hostileCreep);
        if (attackErr === ERR_NOT_IN_RANGE) {
            const moveErr = creep.moveTo(hostileCreep, {maxRooms: 1});
            if (moveErr === ERR_NO_PATH) {
                continue;
            }
            return;
        }
        if (attackErr === OK) {
            return;
        }
    }

    //Attack hostile work creeps
    if (secCfg.ATTACK_WORK_CREEPS) {
        const hostWorkCreeps = creep.room.find(FIND_HOSTILE_CREEPS);
        for (const hostileCreep of hostWorkCreeps) {
            const attackErr = creep.attack(hostileCreep);
            if (attackErr === ERR_NOT_IN_RANGE) {
                const moveErr = creep.moveTo(hostileCreep, {maxRooms: 1});
                if (moveErr === ERR_NO_PATH) {
                    continue;
                }
                return;
            }
            if (attackErr === OK) {
                return;
            }
        }
    }

    //Attack hostile structures
    if (secCfg.ATTACK_HOSTILE_STRUCTURES) {
        const structures = creep.room.find(FIND_HOSTILE_STRUCTURES);
        for (const structure of structures) {
            const attackErr = creep.attack(structure);
            if (attackErr === ERR_NOT_IN_RANGE) {
                const moveErr = creep.moveTo(structure, {maxRooms: 1});
                if (moveErr === ERR_NO_PATH) {
                    continue;
                }
                return;
            }
            if (attackErr === OK) {
                return;
            }
        }
    }

    //Park
    const parkConfig = cellConfig[creep.room.name].PARKING;
    creep.moveTo(parkConfig.x, parkConfig.y, {maxRooms: 1});
}

/*
Returns hostile creeps in the same room as creep
*/
function getAttackCreeps(creep: Creep) {
    const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS);
    const attackCreeps = [];
    for (const hostileCreep of hostileCreeps) {
        for (const part in hostileCreep.body) {
            if (HOSTILE_CREEP_PARTS.includes(hostileCreep.body[part].type)) {
                attackCreeps.push(hostileCreep);
                break;
            }
        }
    }
    return attackCreeps;
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
