import dotenv from "dotenv";
import path from "node:path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env.example") });

export const config = {
  databaseUrl: process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/silfable_ai",
  redisUrl: process.env.REDIS_URL || "redis://default:yblPbxcQBMF5BGWJjrWPaMy0ztmMNTRB@redis-13730.c281.us-east-1-2.ec2.cloud.redislabs.com:13730",
  workerEncryptionKey: process.env.WORKER_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};
