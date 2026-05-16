# Fork changes (`our-mods` branch)

This fork carries small patches needed for our setup. Each change is in its own commit.

## Why we forked
1. **Customizable provider gate** for vision/hybrid browser modes (upstream hardcodes Volcengine).
2. **Cross-platform build fix** for `@tarko/agio` (Windows shell quoting).
3. **Headless `run` command compatibility** with the new CSRF middleware.

## Changes

### `feat(agent-tars/core): make GUI provider gate configurable via env`
- File: `multimodal/agent-tars/core/src/environments/local/browser/browser-control-validator.ts`
- The hardcoded `GUI_SUPPORTED_PROVIDERS = ['volcengine']` blocked vision/hybrid modes for any other provider.
- Added two env-driven escape hatches:
  - `TARKO_GUI_ALLOW_ALL=1` — allow any provider through
  - `TARKO_GUI_EXTRA_PROVIDERS=name1,name2` — append to allowlist
- Backwards-compatible: built-in `volcengine` still allowed by default.

### `fix(tarko/agio): drop single quotes from CLI args`
- File: `multimodal/tarko/agio/package.json`
- Windows shell does not strip single quotes around CLI args, so the type name was passed literally including quotes, causing `ts-json-schema-generator` to throw.
- Removed quotes — works cross-platform.

### `fix(tarko/agent-cli/run): fetch CSRF credential before /oneshot/query`
- File: `multimodal/tarko/agent-cli/src/core/commands/run.ts`
- Recent CSRF middleware (upstream commit #1853) returned 403 on the in-process POST that the headless `run` command makes to `/api/v1/oneshot/query`.
- Added a leading GET to `/api/v1/csrf-token` and forwarded the value as `X-CSRF-Token`.

### `fix(agent-infra/browser): unbreak RemoteBrowser CDP attach`
- Files: `packages/agent-infra/browser/src/remote-browser.ts` (source) + `multimodal/patches/@agent-infra__browser@0.1.1.patch` (applied to installed npm package)
- Two bugs made `RemoteBrowser` unusable when attaching to an external CDP endpoint:
  1. URL handling: user-supplied `cdpEndpoint` (e.g. `http://127.0.0.1:9222`) was used as-is for the WebSocket discovery fetch, but the default included `/json/version`. Hitting the bare endpoint returned empty body, `JSON.parse('')` threw. Now normalises: appends `/json/version` if not already present.
  2. Cleanup: `BaseBrowser.close()` called `browser.close()` (forceful chromium shutdown). For an attached browser we should `disconnect()` to leave the upstream alive. Override added.
- The pnpm patch is applied automatically on every `pnpm install` via the `patchedDependencies` field in `multimodal/package.json`.

## Build (from `multimodal/`)
```
npx -y pnpm@9 install
npx -y pnpm@9 bootstrap
```

## Targeted rebuild after editing one package
```
cd multimodal/agent-tars/core && npx -y pnpm@9 build
```

## Where this fork is consumed in the parent project
`../start.js` auto-detects `agent-tars-fork/multimodal/agent-tars/cli/bin/cli.js` and invokes it directly. No `npm install` of the fork is needed.

## Visual feedback (cursor + click ripple)
NOT done as a fork patch. Lives in `../docker/overlay-extension/` as a Chrome extension auto-loaded by CloakBrowser. Reasons:
- Extensions persist across all CDP client sessions
- One install applies to every page automatically
- No coupling to Agent TARS internals
