/*
role.link.js
Functions to manage link structures
*/

import type { CellConfig } from "./config.cell";

const cellConfig: CellConfig = require("./config.cell");

const PROVIDER = "provider";
const REQUESTER = "requester";

function run(link: StructureLink) {
	const type = getType(link);
	if (type === REQUESTER) {
		return;
	}
	if (type === PROVIDER) {
		const lowestRequester = getLowestRequester(link);
		if (lowestRequester === undefined) {
			return;
		}
		link.transferEnergy(lowestRequester);
	} else if (type === undefined) {
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
	let lowestLink = undefined;
	for (const i in linkConfig.REQUESTERS) {
		const id = linkConfig.REQUESTERS[i];
		const newLink = Game.getObjectById(id as Id<StructureLink>);
		if (newLink === null) {
			console.warn(`Got undefined link in config: ${id}`);
			continue;
		}
		const lowestIsUndefined = lowestLink === undefined;
		// biome-ignore lint/style/noNonNullAssertion: Doesn't run if lowestLink is undefined
		if (
			lowestIsUndefined ||
			newLink.store[RESOURCE_ENERGY] < lowestLink!.store[RESOURCE_ENERGY]
		) {
			lowestLink = newLink;
		}
	}
	if (lowestLink === undefined) {
		console.warn(
			`No requesters in room ${link.room.name} despite being in config`,
		);
	}
	return lowestLink;
}

module.exports = { run };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
