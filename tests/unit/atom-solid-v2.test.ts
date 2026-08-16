import {
  RegistryContext,
  RegistryProvider,
  useAtom,
  useAtomInitialValues,
  useAtomRefresh,
  useAtomSubscribe,
  useAtomValue
} from "@effect/atom-solid"
import { render } from "@solidjs/web"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import { createComponent, createEffect, flush } from "solid-js"
import { describe, expect, test } from "vitest"

describe("@effect/atom-solid with Solid 2", () => {
  test("reads, writes, derives, subscribes, and disposes", () => {
    const countAtom = Atom.make(0)
    const doubledAtom = Atom.make((get) => get(countAtom) * 2)
    const registry = AtomRegistry.make()
    const countValues: Array<number> = []
    const doubledValues: Array<number> = []
    const refreshValues: Array<number> = []
    const subscribedValues: Array<number> = []
    let refreshRuns = 0
    const refreshableAtom = Atom.make(() => {
      refreshRuns += 1
      return refreshRuns
    })

    const Probe = () => {
      useAtomInitialValues([[countAtom, 1]])
      const [count, setCount] = useAtom(() => countAtom)
      const doubled = useAtomValue(() => doubledAtom)
      const refreshable = useAtomValue(() => refreshableAtom)
      const refresh = useAtomRefresh(() => refreshableAtom)

      useAtomSubscribe(
        () => doubledAtom,
        (value) => subscribedValues.push(value),
        {
          immediate: true
        }
      )
      createEffect(count, (value) => {
        countValues.push(value)
        if (value === 1) setCount((current) => current + 1)
      })
      createEffect(doubled, (value) => {
        doubledValues.push(value)
      })
      createEffect(refreshable, (value) => {
        refreshValues.push(value)
        if (value === 1) refresh()
      })

      return null
    }

    const container = document.createElement("div")
    const dispose = render(
      () =>
        createComponent(RegistryContext, {
          value: registry,
          get children() {
            return createComponent(Probe, {})
          }
        }),
      container
    )

    flush()
    flush()

    expect(countValues.at(-1)).toBe(2)
    expect(doubledValues.at(-1)).toBe(4)
    expect(refreshValues.at(-1)).toBe(2)
    expect(subscribedValues.at(-1)).toBe(4)

    const observedBeforeDispose = {
      count: countValues.length,
      doubled: doubledValues.length,
      refresh: refreshValues.length,
      subscribed: subscribedValues.length
    }

    dispose()
    registry.set(countAtom, 3)
    flush()

    expect(countValues).toHaveLength(observedBeforeDispose.count)
    expect(doubledValues).toHaveLength(observedBeforeDispose.doubled)
    expect(refreshValues).toHaveLength(observedBeforeDispose.refresh)
    expect(subscribedValues).toHaveLength(observedBeforeDispose.subscribed)
    registry.dispose()
  })

  test("creates a scoped registry through RegistryProvider", () => {
    const countAtom = Atom.make(0)
    const countValues: Array<number> = []

    const Probe = () => {
      const count = useAtomValue(() => countAtom)
      createEffect(count, (value) => {
        countValues.push(value)
      })
      return null
    }

    const container = document.createElement("div")
    const dispose = render(
      () =>
        createComponent(RegistryProvider, {
          initialValues: [[countAtom, 5]],
          get children() {
            return createComponent(Probe, {})
          }
        }),
      container
    )

    flush()

    expect(countValues.at(-1)).toBe(5)
    dispose()
  })
})
