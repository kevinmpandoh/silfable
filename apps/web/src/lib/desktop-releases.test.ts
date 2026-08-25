import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { CURRENT_DESKTOP_RELEASE, NAV_DOWNLOAD_LINKS } from "./desktop-releases.js";

const EXPECTED_VERSION = "0.3.0";

test("current desktop labels and artifact URLs use one release version", () => {
  const release = CURRENT_DESKTOP_RELEASE;
  assert.equal(release.version, EXPECTED_VERSION);
  assert.equal(release.tag, `v${release.version}`);
  assert.match(release.releaseUrl, new RegExp(`/tag/v${release.version}$`, "u"));
  assert.equal(release.windows.label, `Windows v${release.version}`);
  assert.match(release.windows.filename, new RegExp(`Mirae-${release.version}-`, "u"));
  assert.equal(release.linux.label, `Linux v${release.version}`);

  const artifactUrls = [
    release.windows.url,
    release.windows.checksumUrl,
    release.linux.appImageX64Url,
    release.linux.appImageArm64Url,
    release.linux.debX64Url,
    release.linux.debArm64Url,
    release.linux.checksumUrl,
  ];
  for (const url of artifactUrls) assert.match(url, new RegExp(`/download/v${release.version}/`, "u"));
  assert.equal(NAV_DOWNLOAD_LINKS[0].label, `Windows v${release.version}`);
  assert.equal(NAV_DOWNLOAD_LINKS[1].label, `Linux v${release.version}`);
});

test("workspace package versions stay aligned with the current desktop release", () => {
  const repositoryRoot = resolve(process.cwd(), "../..");
  const manifests = [
    "package.json",
    "apps/web/package.json",
    "apps/desktop/package.json",
    "apps/cloud-worker/package.json",
    "packages/contracts/package.json",
  ];
  for (const manifest of manifests) {
    const value = JSON.parse(readFileSync(resolve(repositoryRoot, manifest), "utf8")) as { version?: unknown };
    assert.equal(value.version, CURRENT_DESKTOP_RELEASE.version, `${manifest} version differs from the current release`);
  }
});
