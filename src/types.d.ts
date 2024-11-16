/**
 * @module typedefs
 */

export type Segment = {
    [key in BodyPartConstant]?: number;
};

export type RoomID = string;
export type BuildingID = string;

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
