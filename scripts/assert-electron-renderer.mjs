import assert from "node:assert/strict";

const endpoint = process.argv[2] ?? "http://127.0.0.1:9333";
const deadline = Date.now() + 15_000;
let target;

while (Date.now() < deadline) {
  try {
    const response = await fetch(endpoint + "/json");
    if (response.ok) {
      const targets = await response.json();
      target = targets.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (target !== undefined) break;
    }
  } catch {
    // Electron may not have opened its renderer target yet.
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

assert.ok(target?.webSocketDebuggerUrl, "Electron renderer debugging target did not become ready");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  const resolve = pending.get(message.id);
  if (resolve === undefined) return;
  pending.delete(message.id);
  resolve(message);
});

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

const evaluation = await send("Runtime.evaluate", {
  expression: "JSON.stringify({ bridgeAvailable: typeof window.silfable === 'object', rootHasContent: (document.querySelector('#root')?.textContent?.trim().length ?? 0) > 0, startupFailed: document.querySelector('.startupFailure') !== null })",
  returnByValue: true,
});
socket.close();

assert.equal(evaluation.error, undefined, "Chrome DevTools protocol evaluation failed");
assert.equal(evaluation.result.exceptionDetails, undefined, "Renderer evaluation threw an exception");
const result = JSON.parse(evaluation.result.result.value);
assert.equal(result.bridgeAvailable, true, "Secure preload bridge is unavailable");
assert.equal(result.rootHasContent, true, "React renderer root is empty");
assert.equal(result.startupFailed, false, "Renderer displayed its fail-closed startup fallback");

console.log("Electron renderer root and secure preload bridge are healthy.");
