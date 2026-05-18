import Redis from "ioredis";

const redis = new Redis(`rediss://default:${process.env.UPSTASH_REDIS_REST_TOKEN}@${process.env.UPSTASH_REDIS_REST_HOST}:6379`);

redis.on("connect", () => {
    console.log("Redis Connected");
});

redis.on("error", (err) => {
    console.log("Redis Error:", err);
});

export default redis;