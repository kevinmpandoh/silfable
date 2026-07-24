import { Queue } from "bullmq";
import { Redis } from "ioredis";

const REDIS_URL =
  process.env.REDIS_URL ||
  "redis://default:yblPbxcQBMF5BGWJjrWPaMy0ztmMNTRB@redis-13730.c281.us-east-1-2.ec2.cloud.redislabs.com:13730";

const globalForRedis = globalThis as unknown as {
  redisConnection: Redis | undefined;
  tradingQueue: Queue | undefined;
};

export const redisConnection =
  globalForRedis.redisConnection ??
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

export const tradingQueue =
  globalForRedis.tradingQueue ??
  new Queue("trading-queue", {
    connection: redisConnection,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisConnection = redisConnection;
  globalForRedis.tradingQueue = tradingQueue;
}
