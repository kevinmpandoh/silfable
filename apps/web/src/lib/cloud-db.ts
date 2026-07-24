import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawDbUrl = process.env.DATABASE_URL || "";

// Database is configured if DATABASE_URL exists and has a valid mongodb URI
export const isDbConfigured = Boolean(
  rawDbUrl &&
    (rawDbUrl.startsWith("mongodb://") || rawDbUrl.startsWith("mongodb+srv://"))
);

const databaseUrl = isDbConfigured
  ? rawDbUrl
  : "mongodb://127.0.0.1:27017/silfable_dummy?replicaSet=rs0";

export const cloudDb =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = cloudDb;
}

/**
 * Safely executes a database query. If DATABASE_URL is missing or the database connection
 * times out / fails, it catches the error cleanly and returns the fallback value.
 */
export async function safeDbQuery<T>(queryFn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDbConfigured) {
    return fallback;
  }
  try {
    return await queryFn();
  } catch (err: any) {
    console.warn("[CloudDB] Database query skipped (unreachable database connection):", err?.message || err);
    return fallback;
  }
}
