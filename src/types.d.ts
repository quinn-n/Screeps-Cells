/**
 * @module typedefs
 */

declare global {
	interface Memory {
		allocator: AllocatorMemory;
	}
}

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
