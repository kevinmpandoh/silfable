# Linux Release Pipeline

GitHub Actions uses separate verification and release workflows.

## Pull request verification

- run independently on Ubuntu 22.04 and 24.04
- install from lockfile
- lint and typecheck all workspaces
- unit tests for mission, Desk Rule, DCA, redaction, and IPC schemas
- Electron main/preload build
- Next.js static build
- dependency and secret scanning

## Packaged Linux QA

`Desktop Linux QA` builds x64 AppImage and Debian packages independently on Ubuntu 22.04 and 24.04. Each job audits the ASAR allowlist/denylist, verifies both artifact formats and ELF headers, records the highest required GLIBC symbol version, inspects Debian metadata, launches the unpacked application for ten seconds under Xvfb/X11, and uploads packages, checksums, and runtime logs as QA evidence. Ubuntu 24.04 additionally starts a headless Weston compositor and launches Electron through native Ozone/Wayland.

The smoke test uses a temporary config and runtime directory, disables the Chromium sandbox only inside the already-isolated CI runner, and treats an early Electron exit as failure. It confirms main-process, BrowserWindow, and tray initialization; it does not claim visual tray compatibility with every desktop shell.

## Release matrix

| Architecture | AppImage | DEB | QA baseline |
| --- | --- | --- | --- |
| x64 | yes | yes | Ubuntu 22.04 and 24.04 |
| ARM64 | yes | yes | build-only; native ARM64 runtime QA pending |

The manual workflow requires its stable semantic version to exactly match `apps/desktop/package.json`. It builds both architectures, creates SHA-256 checksums, uploads short-lived Actions artifacts, and creates a draft GitHub Release containing the packages and checksums. Promotion remains manual and should require a successful packaged Linux QA run for the same commit. Artifact signing is still pending key/provenance selection and must not be claimed until configured.

The application requests public metadata only from `api.github.com/repos/kevinmpandoh/silfable/releases/latest`. It can notify users and open the fixed GitHub Releases review page through the main process. It does not download, install, restart, or resume missions automatically.
