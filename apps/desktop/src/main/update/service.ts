import { UpdateStatusSchema, type UpdateStatus } from "@silfable/contracts";

export const GITHUB_LATEST_RELEASE_API =
  "https://api.github.com/repos/kevinmpandoh/silfable/releases/latest" as const;
export const GITHUB_RELEASE_REVIEW_URL =
  "https://github.com/kevinmpandoh/silfable/releases/latest" as const;

type LatestRelease = { tagName: string; publishedAt: string };
export type ReleaseTransport = () => Promise<LatestRelease>;
export type ExternalReviewOpener = (url: typeof GITHUB_RELEASE_REVIEW_URL) => Promise<void>;

export async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = await fetch(GITHUB_LATEST_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "Silfable-Desktop",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`GitHub release check failed with status ${response.status}`);
  return parseLatestRelease(await response.json());
}

export class UpdateReviewService {
  readonly #currentVersion: string;
  readonly #transport: ReleaseTransport;
  readonly #openExternal: ExternalReviewOpener;
  #status: UpdateStatus;
  #checking: Promise<UpdateStatus> | null = null;

  constructor(input: {
    currentVersion: string;
    transport?: ReleaseTransport;
    openExternal: ExternalReviewOpener;
  }) {
    this.#currentVersion = normalizeVersion(input.currentVersion);
    this.#transport = input.transport ?? fetchLatestRelease;
    this.#openExternal = input.openExternal;
    this.#status = this.#makeStatus({ state: "not-checked", latestVersion: null, publishedAt: null, checkedAt: null });
  }

  getStatus(): UpdateStatus {
    return { ...this.#status };
  }

  check(): Promise<UpdateStatus> {
    if (this.#checking !== null) return this.#checking;
    this.#checking = this.#performCheck().finally(() => {
      this.#checking = null;
    });
    return this.#checking;
  }

  async openReview(): Promise<void> {
    await this.#openExternal(GITHUB_RELEASE_REVIEW_URL);
  }

  async #performCheck(): Promise<UpdateStatus> {
    const checkedAt = new Date().toISOString();
    try {
      const release = await this.#transport();
      const latestVersion = normalizeVersion(release.tagName);
      this.#status = this.#makeStatus({
        state: isNewerVersion(latestVersion, this.#currentVersion) ? "available" : "up-to-date",
        latestVersion,
        publishedAt: new Date(release.publishedAt).toISOString(),
        checkedAt,
      });
    } catch {
      this.#status = this.#makeStatus({ state: "unavailable", latestVersion: null, publishedAt: null, checkedAt });
    }
    return this.getStatus();
  }

  #makeStatus(input: Pick<UpdateStatus, "state" | "latestVersion" | "publishedAt" | "checkedAt">): UpdateStatus {
    return UpdateStatusSchema.parse({
      schemaVersion: 1,
      ...input,
      currentVersion: this.#currentVersion,
      reviewUrl: GITHUB_RELEASE_REVIEW_URL,
      automaticDownload: false,
      automaticInstall: false,
      automaticRestart: false,
    });
  }
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const left = parseVersion(candidate);
  const right = parseVersion(current);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return (left[index] ?? 0) > (right[index] ?? 0);
  }
  return false;
}

function normalizeVersion(value: string): string {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (match === null) throw new Error("Release version is not stable semantic versioning");
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function parseVersion(value: string): [number, number, number] {
  const normalized = normalizeVersion(value);
  const parts = normalized.split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function parseLatestRelease(value: unknown): LatestRelease {
  if (typeof value !== "object" || value === null) throw new Error("GitHub release response is invalid");
  const release = value as Record<string, unknown>;
  if (typeof release.tag_name !== "string" || typeof release.published_at !== "string") {
    throw new Error("GitHub release response is incomplete");
  }
  const publishedAt = new Date(release.published_at);
  if (Number.isNaN(publishedAt.getTime())) throw new Error("GitHub release timestamp is invalid");
  return { tagName: release.tag_name, publishedAt: publishedAt.toISOString() };
}
