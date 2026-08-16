import * as AtomSolid from "@effect/atom-solid/Hooks"
import { RegistryProvider } from "@effect/atom-solid/RegistryContext"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { createMemo, For } from "solid-js"
import {
  filterAtom,
  type TodoFilter,
  todosAtom,
  todoStatsAtom,
  useBrokenEndpointAtom,
  visibleTodosAtom
} from "./state.ts"
import "./styles.css"

const filters: ReadonlyArray<{ readonly value: TodoFilter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "done", label: "Done" }
]

export default function App() {
  return (
    <RegistryProvider>
      <TodoApp />
    </RegistryProvider>
  )
}

function TodoApp() {
  const result = AtomSolid.useAtomValue(() => visibleTodosAtom)
  const statsResult = AtomSolid.useAtomValue(() => todoStatsAtom)
  const [filter, setFilter] = AtomSolid.useAtom(() => filterAtom)
  const [useBrokenEndpoint, setUseBrokenEndpoint] = AtomSolid.useAtom(() => useBrokenEndpointAtom)
  const refresh = AtomSolid.useAtomRefresh(() => todosAtom)

  const todos = createMemo(() => AsyncResult.getOrElse(result(), () => []))
  const stats = createMemo(() =>
    AsyncResult.getOrElse(statsResult(), () => ({ all: 0, open: 0, done: 0 }))
  )
  const errorMessage = createMemo(() =>
    AsyncResult.matchWithError(result(), {
      onInitial: () => undefined,
      onError: (error) => error.message,
      onDefect: () => "An unexpected defect occurred while running the Effect.",
      onSuccess: () => undefined
    })
  )
  const isInitialLoading = createMemo(() => result()._tag === "Initial" && result().waiting)
  const hasPreviousData = createMemo(() => {
    const current = result()
    return AsyncResult.isFailure(current) && Option.isSome(current.previousSuccess)
  })

  const retry = () => {
    if (useBrokenEndpoint()) {
      setUseBrokenEndpoint(false)
    } else {
      refresh()
    }
  }

  return (
    <main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Effect data lab / 01</p>
          <h1>
            One request.
            <br />
            Every state accounted for.
          </h1>
        </div>
        <p class="intro">
          Effect describes a typed HTTP program. Atom runs and shares it. Solid renders the
          resulting state without a request <code>createEffect</code> or a pile of booleans.
        </p>
      </header>

      <section class="flow" aria-label="Data flow">
        <div>
          <span>01</span>
          <strong>Effect</strong>
          <small>fetch + decode + typed error</small>
        </div>
        <div>
          <span>02</span>
          <strong>Atom</strong>
          <small>run + cache + refresh</small>
        </div>
        <div>
          <span>03</span>
          <strong>Solid</strong>
          <small>subscribe + render</small>
        </div>
      </section>

      <section class="workspace">
        <aside class="controls">
          <div class="control-block">
            <p class="label">AsyncResult</p>
            <div class="result-readout">
              <strong>{result()._tag}</strong>
              <span class={result().waiting ? "pulse" : ""}>
                waiting: {String(result().waiting)}
              </span>
            </div>
            <p class="hint">
              <code>waiting</code> stays independent from success or failure, so refreshes do not
              erase useful data.
            </p>
          </div>

          <div class="control-block">
            <p class="label">Failure switch</p>
            <label class="switch-row">
              <input
                type="checkbox"
                checked={useBrokenEndpoint()}
                onChange={(event) => setUseBrokenEndpoint(event.currentTarget.checked)}
              />
              <span class="switch" aria-hidden="true" />
              <span>Use broken endpoint</span>
            </label>
            <p class="hint">
              Change this after data loads. Atom keeps the previous success while exposing the typed
              failure.
            </p>
          </div>

          <div class="control-block file-map">
            <p class="label">Where to look</p>
            <p>
              <code>api.ts</code>
              <span>Effect</span>
            </p>
            <p>
              <code>state.ts</code>
              <span>Atom</span>
            </p>
            <p>
              <code>App.tsx</code>
              <span>Solid</span>
            </p>
          </div>
        </aside>

        <div class="data-panel">
          <div class="toolbar">
            <div class="filters" aria-label="Filter todos">
              {filters.map((item) => (
                <button
                  type="button"
                  class={filter() === item.value ? "active" : ""}
                  aria-pressed={filter() === item.value ? "true" : "false"}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                  <sup>{stats()[item.value]}</sup>
                </button>
              ))}
            </div>
            <button type="button" class="refresh" onClick={refresh} disabled={result().waiting}>
              {result().waiting ? "Fetching..." : "Refresh"}
            </button>
          </div>

          {errorMessage() === undefined ? null : (
            <div class="error-panel" role="alert">
              <div>
                <strong>
                  {hasPreviousData()
                    ? "Refresh failed; showing cached data."
                    : "Could not load todos."}
                </strong>
                <p>{errorMessage()}</p>
              </div>
              <button type="button" onClick={retry}>
                Try again
              </button>
            </div>
          )}

          {isInitialLoading() ? (
            <div class="loading-state" aria-live="polite">
              <span class="loader" />
              <div>
                <strong>Running the Effect</strong>
                <p>The first request has no previous value, so the atom is Initial + waiting.</p>
              </div>
            </div>
          ) : todos().length === 0 && errorMessage() === undefined ? (
            <div class="empty-state">No todos match this filter.</div>
          ) : (
            <ol class={result().waiting ? "todo-list refreshing" : "todo-list"}>
              <For each={todos()}>
                {(todo) => (
                  <li>
                    <span
                      class={todo.completed ? "check done" : "check"}
                      aria-label={todo.completed ? "Done" : "Open"}
                    />
                    <span>{todo.title}</span>
                    <small>#{String(todo.id).padStart(3, "0")}</small>
                  </li>
                )}
              </For>
            </ol>
          )}
        </div>
      </section>

      <footer>
        Data from{" "}
        <a href="https://jsonplaceholder.typicode.com/" target="_blank" rel="noreferrer">
          JSONPlaceholder
        </a>
        . Schema decoding means invalid JSON becomes a typed failure too.
      </footer>
    </main>
  )
}
