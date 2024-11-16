/*
resourceMgr
API that manages resource transfers between individual cells
*/

import type { RoomID } from "./types";

function run() {

}

//Marks a room with a given number of resources available
function setResourceAvailable(roomID: RoomID, resourceType: ResourceConstant, amount: number) {
    Memory.resourceMgr.available[resourceType][roomID] = amount;
}

function requestResource(roomID: RoomID, resourceType: ResourceConstant, amount: number) {
    if (Memory.resourceMgr.available[resourceType] !== undefined) {
        //Transfer resourrce from terminal
    }
    Memory.resourceMgr.request[resourceType][roomID] = amount;
}

//Returns a list of resource transfers the room should complete
/*
getInstructions: function(roomID) {
    var room = Game.rooms[roomID];
    for (var res in Memory.resourceMgr.request) {
        var request = Memory.resourceMgr.request[res];
        if (request[roomID] !== undefined) {

        }
    }
}
*/

