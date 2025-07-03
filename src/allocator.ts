import _ from "lodash";
import type { BaseCreep } from "./creep.base";
import BaseAllocator from "./allocator.base";

/**
 * Add a new deposit time to the source's history.
 * If the history is longer than HISTORY_LENGTH, remove the oldest entries.
 */
export function addSourceDepositTime(
	sourceId: Id<Source>,
	creep: BaseCreep,
	time: number,
) {
	const memory = Memory.allocator;
	if (memory._sourceDepositTimes[sourceId] === undefined) {
		memory._sourceDepositTimes[sourceId] = [];
	}

	const workMoveRatio =
		creep.body.filter((part) => part.type === WORK).length /
		creep.body.filter((part) => part.type === MOVE).length;

	memory._sourceDepositTimes[sourceId].unshift({
		time,
		workMoveRatio,
	});
	while (
		memory._sourceDepositTimes[sourceId].length > BaseAllocator.HISTORY_LENGTH
	) {
		memory._sourceDepositTimes[sourceId].pop();
	}
}
