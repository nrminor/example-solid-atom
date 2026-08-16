# Effect + Effect Atom + Solid 2

A small client-rendered application showing one complete data-fetching flow. It deliberately avoids request-related component state and `createEffect` calls so each library's responsibility is visible.

```text
Solid event / render
        |
Effect Atom (state, dependencies, execution, cache, refresh)
        |
Effect service (HTTP policy, schema decoding, typed errors)
```

## Run it

Install the pinned toolchain and dependencies, then start Vite:

```sh
mise install
pnpm install
pnpm dev
```

For browser automation and the project checks:

```sh
mise run browser-install
pnpm test:unit
pnpm test:e2e
pnpm lint
pnpm build
```

pnpm uses its global virtual store for local installs. Browser binaries use the separate Playwright and agent-browser caches.

## What to try

1. Reload the page to see the initial `Initial + waiting` state.
2. Press **Refresh**. Existing todos remain visible as `Success + waiting` while the new request runs.
3. Enable **Use broken endpoint**. The request becomes a typed `TodoApiError`, while `AsyncResult` retains and displays the previous successful todos.
4. Press **Try again**. Changing the writable endpoint atom automatically invalidates the dependent request atom.
5. Change the todo filter. The filter and counts are derived atoms; they do not trigger another HTTP request.

## Where each concern lives

| File                                   | Responsibility                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`src/api.ts`](src/api.ts)             | An Effect service with a fetch client, status handling, transient retries, schema decoding, and a typed error. |
| [`src/state.ts`](src/state.ts)         | Writable UI atoms, the Effect runtime, the request atom, and derived atoms.                                    |
| [`src/App.tsx`](src/App.tsx)           | The registry owner and Solid rendering of loading, refreshing, failure, stale-data, and success states.        |
| [`src/Document.tsx`](src/Document.tsx) | The static HTML document used by Solid's turnkey Vite mode.                                                    |
| [`vite.config.ts`](vite.config.ts)     | Solid's generated client entry, Rolldown tree shaking, and Oxc minification.                                   |

The key distinction is that `AsyncResult` does not collapse every request into `loading | error | data`. Its `waiting` flag is independent of `Initial`, `Success`, and `Failure`, and a failure can retain its previous success. This makes background refresh and stale-data error handling explicit without coordinating several component signals.

## Solid 2 compatibility boundary

This private example pins one tested prerelease graph: Effect and `@effect/atom-solid` `4.0.0-rc.109` with Solid `2.0.0-rc.0`. The published Atom binding excludes Solid 2, so [`patches/@effect__atom-solid@4.0.0-rc.109.patch`](patches/@effect__atom-solid@4.0.0-rc.109.patch) adapts its published `dist` files and the workspace applies an exact peer override.

The patch is not a claim of upstream Solid 2 support. In particular, Solid 2 replaces the old resource return shape, so the locally patched `useAtomResource` returns a `SourceAccessor` rather than upstream's Solid 1 `ResourceReturn`. The application does not expose that hook as public API. Any dependency upgrade must rederive the patch and rerun the compatibility and browser suites.

`Document.tsx` establishes the client-rendered document shell; it does not make the request atom data-SSR-aware. Enabling SSR would require an explicit server data and hydration design rather than only flipping the Vite option.
