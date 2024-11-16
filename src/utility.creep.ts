import type { CellConfig } from "./config.cell";
import type { BaseCreep, RoomID } from "./types";

const cellConfig: CellConfig = require("./config.cell");
    
//Moves a creep towards parking area
function park(creep: BaseCreep) {
    if (creep.room.name !== creep.memory.room) {
        goToRoom(creep, creep.memory.room);
    }
    else {
        const parkingArea = cellConfig[creep.room.name].PARKING;
        creep.moveTo(parkingArea.x, parkingArea.y, {maxRooms: 1});
    }
}

function goToRoom(creep: Creep, room: RoomID) {
    const exit = creep.room.findExitTo(room);
    creep.moveTo(creep.pos.findClosestByRange(exit));
}

module.exports = { park, goToRoom };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
