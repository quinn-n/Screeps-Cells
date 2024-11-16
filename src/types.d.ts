/**
 * @module typedefs
 */

export type Segment = {
    [key in BodyPartConstant]?: number;
};

export type RoomID = string;
export type BuildingID = string;
