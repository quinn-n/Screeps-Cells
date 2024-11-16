
/*
role.link.js
Functions to manage link structures
*/

import type { CellConfig } from "./config.cell";

const cellConfig: CellConfig = require("./config.cell");

const PROVIDER = "provider";
const REQUESTER = "requester";

function run(link: StructureLink) {
    const linkConfig = cellConfig[link.room.name].LINK;
    const type = getType(link);
    if (type === REQUESTER) {
        return;
    }
    if (type === PROVIDER) {
        const lowestId = getLowestRequester(link);
        if (lowestId === undefined) {
            return;
        }
        const lowestLink = Game.getObjectById<StructureLink>(lowestId);
        if (lowestLink === null) {
            console.log(`Got undefined link in config: ${lowestId}`);
            return;
        }
        link.transferEnergy(lowestLink);
    }
    else if (type === undefined) {
        console.log(`Got unconfigured link in room ${link.room.name}`);
    }
}


/*
Returns the type of a link, whether it's a supplier or a requester
Returns undefined if the link isn't in either
*/
function getType(link: StructureLink) {
    const linkConfig = cellConfig[link.room.name].LINK;
    if (linkConfig.PROVIDERS.includes(link.id)) {
        return PROVIDER;
    }
    if (linkConfig.REQUESTERS.includes(link.id)) {
        return REQUESTER;
    }
    return undefined;
}

/*
Returns the requester with the lowest energy value
Returns undefined if no requesters exist in the room
*/
function getLowestRequester(link: StructureLink) {
    const linkConfig = cellConfig[link.room.name].LINK;
    let lowestId = linkConfig.REQUESTERS[0];
    let lowestLink = Game.getObjectById(linkConfig.REQUESTERS[0]);
    for (const i in linkConfig.REQUESTERS) {
        const id = linkConfig.REQUESTERS[i];
        const newLink = Game.getObjectById(id);
        if (newLink === null) {
            console.warn(`Got undefined link in config: ${id}`);
            continue;
        }
        if (newLink.store[RESOURCE_ENERGY] < Game.getObjectById<StructureLink>(lowestId).store[RESOURCE_ENERGY]) {
            lowestId = id;
        }
    }
    return lowestId;
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
