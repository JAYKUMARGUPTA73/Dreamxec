const redis = require("redis");

const client = redis.createClient({
  url: "redis://default:9voK798IwlHe0SljRAB7eKEhfOk7rS0L@redis-15939.c257.us-east-1-3.ec2.cloud.redislabs.com:15939",
  socket: {
    reconnectStrategy: (retries) => {
      console.log(`🔁 Redis reconnect attempt #${retries}`);
      return Math.min(retries * 100, 3000); // retry delay
    },
  },
});

client.on("connect", () => {
  console.log("🔄 Redis connecting...");
});


client.on("error", (err) => {
  console.error("❌ Redis Client Error:", err.message);
});

client.connect();

module.exports = client;
