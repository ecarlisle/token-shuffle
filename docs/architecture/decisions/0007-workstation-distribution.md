# ADR 0007: Tauri shell with an independent Node proxy

- Status: Accepted
- Date: 2026-06-29

## Context

Token Shuffle is a workstation application that must run reliably between local
agent clients and inference providers. Technical users need a standalone CLI,
while general workstation users benefit from installers, a tray icon,
launch-at-login behavior, credential integration, and signed updates.

Running the proxy only inside a desktop window would couple inference
availability to UI lifecycle. Bundling Chromium would also add substantial
runtime weight to an application whose interface can use the operating system
webview.

## Decision

Keep the TypeScript Node proxy independently runnable and use Tauri 2 as a thin
desktop shell after the proxy and dashboard are stable.

The Tauri layer owns only:

- native window and tray lifecycle;
- proxy sidecar startup, health checks, supervision, and shutdown;
- launch-at-login integration;
- native credential-store integration;
- installers, signing, and updates;
- desktop-specific diagnostics.

The proxy remains a packaged Node sidecar and owns all HTTP, provider, context,
routing, accounting, cache, event, and persistence behavior. Closing the
dashboard window does not stop the proxy unless the user explicitly quits the
application.

Development and early releases support a standalone CLI and browser dashboard.
Electron is a fallback only if a packaging spike proves the Tauri sidecar
unreliable. Node single-executable applications are not the primary packaging
foundation while the feature remains under active development.

## Consequences

- The service can be tested independently of desktop UI behavior.
- The same proxy supports headless, CLI, browser, and desktop-shell use.
- Rust remains a small OS-integration surface rather than a second business
  implementation.
- Release engineering must build, sign, and smoke-test each supported platform.
- Sidecar lifecycle, port discovery, upgrades, and crash recovery require
  dedicated integration tests.
- Desktop work is intentionally later than protocol and measurement correctness.
