/**
 * @module typedefs
 */

export type Segment = {
    [key in BodyPartConstant]?: number;
};

export type RoomID = string;
export type BuildingID = string;

export type StorageStructure = (
    StructureContainer |
    StructureStorage |
    StructureTerminal |
    StructureLink |
    StructureLab |
    StructureNuker |
    StructureFactory |
    StructurePowerSpawn |
    StructureSpawn |
    StructureTower
);

export interface BaseCreepMemory extends CreepMemory {
    role: CreepType;
    home: RoomID;
    room: RoomID;
    spawner: Id<StructureSpawn>;
    toRecycle: boolean;
}

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
