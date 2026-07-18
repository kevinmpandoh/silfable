# Desktop Security QA Gate

## Renderer boundary

The production BrowserWindow always enables context isolation, sandboxing, and web security while disabling Node integration, webviews, insecure content, and drag-and-drop navigation. Application permission checks and prompts return false. New windows, renderer navigation, and webview attachment are denied.

The renderer Content Security Policy permits only packaged scripts, styles, fonts, and images. It blocks objects, base URL changes, form submission, frames, workers, media, remote script origins, inline scripts, and eval-style execution.

## IPC boundary

Every handler verifies all of the following before parsing a request or performing work:

- sender is the exact current main-window WebContents object;
- sender is not destroyed;
- sender frame is the WebContents top frame;
- channel is one of the compile-time `IPC_CHANNELS` entries;
- request matches its one-purpose versioned schema.

Security-sensitive request objects are strict. Unknown fields are rejected instead of silently removed. Tests inject privilege-shaped fields including arbitrary URLs, upload destinations, private keys, Solana instructions, tool arrays, and Jupiter taker addresses.

## Bundle boundary

`npm run audit:desktop` scans built renderer and preload HTML/JavaScript. CI and release workflows fail if those bundles contain privileged markers such as SQLite, filesystem/process access, keystore/encryption internals, provider API headers, signing functions, crash tables, or fixed main-process network transports.

The audit intentionally runs after the Electron build. It complements TypeScript and unit tests; it does not replace Linux package inspection or runtime sandbox QA.

## Packaged QA automation

- Ubuntu 22.04 and 24.04 x64 package builds, checksum generation, ASAR inspection, GLIBC checks, and X11 smoke tests are defined in `.github/workflows/desktop-linux-qa.yml`.
- Ubuntu 24.04 additionally runs a native Ozone/Wayland smoke test with headless Weston.
- These gates become completed evidence only after the workflow passes on GitHub; defining the workflow locally is not itself a QA result.

Remaining distribution gates are artifact signing/provenance selection, native ARM64 runtime testing, and manual visual tray verification under representative GNOME/KDE shells.

## Completed reliability gates

- Keystore rejects locked/unavailable/insecure backends, malformed files, unknown records, oversized files, and altered ciphertext.
- Secret mutations are serialized to prevent lost records. The shared database encryption key uses single-flight initialization to prevent concurrent key replacement.
- Overlapping scheduler ticks create exactly one cycle. Restart initialization halts running missions and never performs catch-up.
- Devnet canary tests inject network loss after simulation, after signing, and after broadcast. Pre-broadcast loss prevents transmission; post-broadcast loss remains ambiguous and never triggers automatic rebroadcast.
