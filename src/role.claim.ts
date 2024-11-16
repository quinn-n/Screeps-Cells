
/*
role.claim.js
Functions to manage claim creeps
*/

const _ = require("lodash");
const cellConfig = require("./config.cell");
const utilityCreep = require("./utility.creep");
import type { RoomID } from "./typedefs";

function run(creep: Creep) {
    //var reserveCfg = cellConfig[creep.memory.room][creep.memory.role];

    if (creep.memory.room === creep.memory.home || own(creep.memory.room)) {
        setRoom(creep);
    }

    if (creep.room.name !== creep.memory.room) {
        utilityCreep.goToRoom(creep, creep.memory.room);
        return;
    }

    const reserveCfg = cellConfig[creep.memory.home][creep.memory.role];

    const controller = creep.room.controller;
    if (controller === undefined) {
        console.log(`Claim creep ${creep.name} in room ${creep.room.name} has no controller. Please double-check config.`);
        return;
    }
    if (reserveCfg.CLAIM_ROOMS.includes(creep.room.name)) {
        const err = creep.claimController(controller);
        if (err === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {maxRooms: 1});
            console.log("Moving to controller");
            return;
        }
        if (err === OK) {
            return;
        }
        if (err === ERR_GCL_NOT_ENOUGH) {
            console.log(`GCL not enough to claim room ${creep.room.name}`);
            creep.reserveController(controller);
            return;
        }
        console.log(`Claim creep got error: ${err}`);
        return;
    }
    if (reserveCfg.RESERVE_ROOMS.includes(creep.room.name)) {
        const err = creep.reserveController(controller);
        if (err === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, {maxRooms: 1});
            return;
        }
        if (err === OK) {
            return;
        }
        console.log(`Claim creep got error: ${err}`);
    }
}

/*
Sets creep's room
*/
function setRoom(creep: Creep) {
    const reserveCfg = cellConfig[creep.memory.home][creep.memory.role];
    const CLAIM_ROOMS = reserveCfg.CLAIM_ROOMS;
    for (const roomID of CLAIM_ROOMS) {
        if (!hasCreepAssigned(roomID) && !own(roomID)) {
            creep.memory.room = roomID;
            return;
        }
    }
    const RESERVE_ROOMS = reserveCfg.RESERVE_ROOMS;
    for (const roomID of RESERVE_ROOMS) {
        if (!hasCreepAssigned(roomID)) {
            creep.memory.room = roomID;
            return;
        }
    }
}

/*
Returns true if room is owned by the player
*/
function own(roomID: RoomID) {
    return (Game.rooms[roomID]?.controller.my);
}

/*
Returns true if a given room has a reserve creep assigned to it
*/
function hasCreepAssigned(roomID: RoomID) {
    const creeps = _.filter(Game.creeps, (creep) => creep.memory.role === "reserve" && creep.memory.room === roomID);
    return (creeps.length) > 0;
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
