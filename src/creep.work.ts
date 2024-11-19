import type { BaseCreepTask } from "./creep.base";

export type WorkCreepTask =
	| BaseCreepTask
	| "harvesting"
	| "building"
	| "upgrading"
	| "repairing";
