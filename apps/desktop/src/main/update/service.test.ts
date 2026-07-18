import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchLatestRelease,
  GITHUB_RELEASE_REVIEW_URL,
  isNewerVersion,
  UpdateReviewService,
} from "./service";

test("semantic version comparison does not treat equal or older releases as updates", () => {
  assert.equal(isNewerVersion("1.2.0", "1.1.9"), true);
  assert.equal(isNewerVersion("v1.2.0", "1.2.0"), false);
  assert.equal(isNewerVersion("1.1.9", "1.2.0"), false);
});

test("update status proves download, install, and restart remain disabled", async () => {
  const opened: string[] = [];
  const service = new UpdateReviewService({
    currentVersion: "0.1.0",
    transport: async () => ({ tagName: "v0.2.0", publishedAt: "2026-07-17T00:00:00.000Z" }),
    openExternal: async (url) => { opened.push(url); },
  });
  const status = await service.check();
  assert.equal(status.state, "available");
  assert.equal(status.latestVersion, "0.2.0");
  assert.equal(status.automaticDownload, false);
  assert.equal(status.automaticInstall, false);
  assert.equal(status.automaticRestart, false);
  await service.openReview();
  assert.deepEqual(opened, [GITHUB_RELEASE_REVIEW_URL]);
});

test("provider errors fail closed without inventing release metadata", async () => {
  const service = new UpdateReviewService({
    currentVersion: "0.1.0",
    transport: async () => { throw new Error("offline"); },
    openExternal: async () => undefined,
  });
  const status = await service.check();
  assert.equal(status.state, "unavailable");
  assert.equal(status.latestVersion, null);
  assert.equal(status.publishedAt, null);
});

test("GitHub transport uses the fixed repository endpoint and versioned headers", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.github.com/repos/kevinmpandoh/silfable/releases/latest");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-GitHub-Api-Version"), "2026-03-10");
    assert.equal(headers.get("Authorization"), null);
    return new Response(JSON.stringify({ tag_name: "v0.2.0", published_at: "2026-07-17T00:00:00Z" }), { status: 200 });
  };
  try {
    assert.equal((await fetchLatestRelease()).tagName, "v0.2.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
