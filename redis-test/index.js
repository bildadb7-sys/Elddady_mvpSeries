const Valkey = require("ioredis");
const serviceUri = process.env.REDIS_URI || "";
const valkey = new Valkey(serviceUri);

valkey.set("key", "hello world");

valkey.get("key").then(function (result) {
    console.log(`The value of key is: ${result}`);
    valkey.disconnect();
});
