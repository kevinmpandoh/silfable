# Linux Release Pipeline

GitHub Actions uses separate verification and release workflows.

## Pull request verification

- install from lockfile
- lint and typecheck all workspaces
- unit tests for mission, Desk Rule, DCA, redaction, and IPC schemas
- Electron main/preload build
- Next.js static build
- dependency and secret scanning

## Release matrix

| Architecture | AppImage | DEB | QA baseline |
| --- | --- | --- | --- |
| x64 | yes | yes | Ubuntu 22.04 and 24.04 |
| ARM64 | yes | yes | Ubuntu 22.04 and 24.04 ARM64 |

Artifacts include SHA-256 checksums, release notes, and signatures. Publishing creates a draft GitHub Release first. Promotion remains manual after smoke tests on Wayland and X11.

The application only notifies users that a release exists and opens its review page. It does not download, install, restart, or resume missions automatically.
