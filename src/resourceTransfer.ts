
/*
resourceTransfer.js
Class that contains information necessary to transfer resources between rooms
*/

module.exports = {
    ResourceTransfer: class {
        constructor(resourceType, roomID, amount) {
            this.resourceType = resourceType;
            this.roomID = roomID;
            this.amount = amount;
        }
    }
};
