// Client-side IndexedDB helper for Web App Chat History & Sessions

export interface SessionItem {
  id: string;
  title: string;
  filter: "all" | "agent" | "mission" | "pump" | "active" | "limit" | "custom";
  createdAt: number;
  updatedAt: number;
}

export interface WebProposal {
  id: string;
  type: "jupiter_swap" | "pump_fun_buy" | "limit_order";
  mint: string;
  solAmount: string;
  estimatedTokens: string;
  status: "ready_for_user_signature" | "preview_only" | "signing" | "signed" | "failed";
  mode: string;
  explanation: string;
  checks?: Array<{ code: string; status: "pass" | "block"; message: string }>;
  inputAmount?: string;
  outputAmount?: string;
  minimumOutputAmount?: string;
  inputMint?: string;
  outputMint?: string;
  outputSymbol?: string;
  venue?: string;
  quoteResponse?: unknown;
}

export interface WebMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  proposal?: WebProposal;
  usage?: WebUsage;
  createdAt: number;
}

export interface WebUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
  model: string;
}

const DB_NAME = "silfable_web_db_v1";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in browser environments."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("sessions")) {
        const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
        sessionStore.createIndex("filter", "filter", { unique: false });
        sessionStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("messages")) {
        const messageStore = db.createObjectStore("messages", { keyPath: "id" });
        messageStore.createIndex("sessionId", "sessionId", { unique: false });
        messageStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSessions(): Promise<SessionItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readonly");
      const store = tx.objectStore("sessions");
      const index = store.index("updatedAt");
      const request = index.getAll();

      request.onsuccess = () => {
        // Return sorted descending (newest first)
        const items: SessionItem[] = request.result || [];
        resolve(items.reverse());
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB getAllSessions error:", err);
    return [];
  }
}

export async function saveSession(session: SessionItem): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      const store = tx.objectStore("sessions");
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB saveSession error:", err);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "messages"], "readwrite");
      tx.objectStore("sessions").delete(sessionId);

      const messageStore = tx.objectStore("messages");
      const index = messageStore.index("sessionId");
      const range = IDBKeyRange.only(sessionId);
      const req = index.openCursor(range);

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB deleteSession error:", err);
  }
}

export async function deleteAllSessions(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "messages"], "readwrite");
      tx.objectStore("sessions").clear();
      tx.objectStore("messages").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB deleteAllSessions error:", err);
  }
}

export async function getSessionMessages(sessionId: string): Promise<WebMessage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const index = store.index("sessionId");
      const request = index.getAll(IDBKeyRange.only(sessionId));

      request.onsuccess = () => {
        const items: WebMessage[] = request.result || [];
        // Sort ascending by createdAt
        resolve(items.sort((a, b) => a.createdAt - b.createdAt));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB getSessionMessages error:", err);
    return [];
  }
}

export async function saveMessage(msg: WebMessage): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      const request = store.put(msg);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB saveMessage error:", err);
  }
}
