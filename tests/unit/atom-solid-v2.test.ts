import {
  RegistryContext,
  RegistryProvider,
  useAtom,
  useAtomInitialValues,
  useAtomRef,
  useAtomRefresh,
  useAtomSubscribe,
  useAtomValue
} from "@effect/atom-solid"
import { render } from "@solidjs/web"
import { Atom, AtomRef, AtomRegistry } from "effect/unstable/reactivity"
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
    let disposed = false

    try {
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
      disposed = true
      registry.set(countAtom, 3)
      flush()

      expect(countValues).toHaveLength(observedBeforeDispose.count)
      expect(doubledValues).toHaveLength(observedBeforeDispose.doubled)
      expect(refreshValues).toHaveLength(observedBeforeDispose.refresh)
      expect(subscribedValues).toHaveLength(observedBeforeDispose.subscribed)
    } finally {
      if (!disposed) dispose()
      registry.dispose()
    }
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

    try {
      flush()
      expect(countValues.at(-1)).toBe(5)
    } finally {
      dispose()
    }
  })

  test("preserves function-valued atoms and refs", () => {
    const first = () => 1
    const second = () => 2
    const selectedFunctionAtom = Atom.make(0)
    const functionAtom = Atom.readable((get) => (get(selectedFunctionAtom) === 0 ? first : second))
    const functionRef = AtomRef.make(first)
    const registry = AtomRegistry.make()
    let observedAtomValue: (() => number) | undefined
    let observedRefValue: (() => number) | undefined

    const Probe = () => {
      const atomValue = useAtomValue(() => functionAtom)
      const refValue = useAtomRef(() => functionRef)
      createEffect(atomValue, (value) => {
        observedAtomValue = value
      })
      createEffect(refValue, (value) => {
        observedRefValue = value
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

    try {
      flush()
      expect(observedAtomValue).toBe(first)
      expect(observedRefValue).toBe(first)

      registry.set(selectedFunctionAtom, 1)
      functionRef.set(second)
      flush()

      expect(observedAtomValue).toBe(second)
      expect(observedRefValue).toBe(second)
    } finally {
      dispose()
      registry.dispose()
    }
  })
})
