/**
 * @module typedefs
 */

export type Segment = {
	[key in BodyPartConstant]?: number;
};

export type RoomID = string;
export type BuildingID = string;

export type StorageStructure =
	| StructureContainer
	| StructureStorage
	| StructureTerminal
	| StructureLink
	| StructureLab
	| StructureNuker
	| StructureFactory
	| StructurePowerSpawn
	| StructureSpawn
	| StructureTower;

export type STORAGE_STRUCTURE =
	| STRUCTURE_STORAGE
	| STRUCTURE_STORAGE
	| STRUCTURE_TERMINAL
	| STRUCTURE_LINK
	| STRUCTURE_LAB
	| STRUCTURE_NUKER
	| STRUCTURE_FACTORY
	| STRUCTURE_POWER_SPAWN
	| STRUCTURE_SPAWN
	| STRUCTURE_TOWER;

export interface BaseCreep extends Creep {
	memory: BaseCreepMemory;
}

export interface HarvestingCreepMemory extends BaseCreepMemory {
	harvesting: boolean;
	targetSource: Id<Source> | null;
}

export interface HarvestingCreep extends BaseCreep {
	memory: HarvestingCreepMemory;
}
