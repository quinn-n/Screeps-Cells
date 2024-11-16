
const cleanup = require("./cleanup");
const pixelGenerator = require("./pixel.generator");

const roleRoom = require("./role.room");

function loop() {
    cleanup.run();

    pixelGenerator.run();

    for (const r in Game.rooms) {
        roleRoom.run(r);
    }
}

module.exports = { loop };

// This just makes sure that typescript recognises the file as a module.
export default module.exports;
