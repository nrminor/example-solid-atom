import { expect, test, type Page, type Route } from "@playwright/test"

const denyUnexpectedNetwork = (page: Page): Promise<void> =>
  page
    .route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (url.origin === "http://127.0.0.1:5173") {
        return route.continue()
      }
      throw new Error(`Unexpected external request: ${url.href}`)
    })
    .then(() => undefined)

const requireRoute = (route: Route | undefined, description: string): Route => {
  if (route === undefined) throw new Error(`No intercepted route for ${description}`)
  return route
}

const todos = [
  { userId: 1, id: 1, title: "Write the Effect", completed: false },
  { userId: 1, id: 2, title: "Decode the response", completed: true },
  { userId: 1, id: 3, title: "Render the atoms", completed: false },
  { userId: 1, id: 4, title: "Verify the result", completed: true }
]

const refreshedTodos = [
  { userId: 1, id: 5, title: "Ship the migration", completed: true },
  { userId: 1, id: 6, title: "Watch the diagnostics", completed: false }
]

const openTodos = [
  { userId: 1, id: 1, title: "Write the Effect", completed: false },
  { userId: 1, id: 3, title: "Render the atoms", completed: false }
]

test("shows the initial waiting state without an empty result", async ({ page }) => {
  let pendingResponse: Route | undefined

  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", (route) => {
    pendingResponse = route
  })

  await page.goto("/")

  await expect(page.getByText("Initial", { exact: true })).toBeVisible()
  await expect(page.getByText("waiting: true", { exact: true })).toBeVisible()
  await expect(page.getByText("Running the Effect")).toBeVisible()
  await expect(page.getByRole("button", { name: "Fetching..." })).toBeDisabled()
  await expect(page.getByText("No todos match this filter.")).toHaveCount(0)

  await requireRoute(pendingResponse, "the initial todo request").fulfill({ json: todos })
  await expect(page.getByRole("listitem")).toHaveCount(4)
})

test("renders and filters decoded todos without refetching", async ({ page }) => {
  let requestCount = 0

  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    requestCount += 1
    expect(route.request().method()).toBe("GET")
    expect(new URL(route.request().url()).searchParams.get("_limit")).toBe("12")
    await route.fulfill({ json: todos })
  })

  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "One request. Every state accounted for." })
  ).toBeVisible()
  await expect(page.getByRole("listitem")).toHaveCount(4)
  await expect(page.locator('[aria-label="Done"]')).toHaveCount(2)
  await expect(page.locator('[aria-label="Open"]')).toHaveCount(2)
  await expect(page.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true")

  await page.getByRole("button", { name: /^Open/ }).click()

  await expect(page.getByRole("listitem")).toHaveCount(2)
  await expect(page.getByRole("button", { name: /^Open/ })).toHaveAttribute("aria-pressed", "true")
  expect(requestCount).toBe(1)
})

test("retains successful data while a refresh is waiting", async ({ page }) => {
  let requestCount = 0
  let pendingRefresh: Route | undefined

  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    requestCount += 1
    if (requestCount === 1) {
      await route.fulfill({ json: todos })
      return
    }
    pendingRefresh = route
  })

  await page.goto("/")
  await expect(page.getByRole("listitem")).toHaveCount(4)

  await page.getByRole("button", { name: "Refresh" }).click()

  await expect(page.getByText("Success", { exact: true })).toBeVisible()
  await expect(page.getByText("waiting: true", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Fetching..." })).toBeDisabled()
  await expect(page.getByRole("listitem")).toHaveCount(4)
  await expect(page.getByText("Write the Effect")).toBeVisible()

  await requireRoute(pendingRefresh, "the refresh request").fulfill({ json: refreshedTodos })

  await expect(page.getByText("waiting: false", { exact: true })).toBeVisible()
  await expect(page.getByRole("listitem")).toHaveCount(2)
  await expect(page.getByText("Ship the migration")).toBeVisible()
})

test("keeps cached data on failure and recovers through retry", async ({ page }) => {
  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    await route.fulfill({ json: todos })
  })
  await page.route(
    "https://jsonplaceholder.typicode.com/this-route-does-not-exist",
    async (route) => {
      await route.fulfill({ status: 404, json: {} })
    }
  )

  await page.goto("/")
  await expect(page.getByRole("listitem")).toHaveCount(4)

  await page.getByText("Use broken endpoint", { exact: true }).click()

  await expect(page.getByText("Failure", { exact: true })).toBeVisible()
  await expect(page.getByRole("alert")).toContainText("Refresh failed; showing cached data.")
  await expect(page.getByRole("listitem")).toHaveCount(4)
  await expect(page.getByRole("checkbox", { name: "Use broken endpoint" })).toBeChecked()

  await page.getByRole("button", { name: "Try again" }).click()

  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByText("Success", { exact: true })).toBeVisible()
  await expect(page.getByRole("listitem")).toHaveCount(4)
  await expect(page.getByRole("checkbox", { name: "Use broken endpoint" })).not.toBeChecked()
})

test("shows an initial failure without stale data", async ({ page }) => {
  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    await route.fulfill({ status: 503, json: {} })
  })

  await page.goto("/")

  await expect(page.getByRole("alert")).toContainText("Could not load todos.")
  await expect(page.getByRole("alert")).toContainText(
    "The API request failed. Check the network connection and try again."
  )
  await expect(page.getByRole("listitem")).toHaveCount(0)
  await expect(page.getByText("No todos match this filter.")).toHaveCount(0)
})

test("recovers an ordinary initial failure through refresh", async ({ page }) => {
  let requestCount = 0

  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    requestCount += 1
    if (requestCount <= 3) {
      await route.fulfill({ status: 503, json: {} })
      return
    }
    await route.fulfill({ json: todos })
  })

  await page.goto("/")
  await expect(page.getByRole("alert")).toContainText("Could not load todos.")

  await page.getByRole("button", { name: "Try again" }).click()

  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByText("Success", { exact: true })).toBeVisible()
  await expect(page.getByRole("listitem")).toHaveCount(4)
  expect(requestCount).toBe(4)
})

test("turns malformed success JSON into a typed initial failure", async ({ page }) => {
  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    await route.fulfill({
      json: [{ userId: 1, id: "not-a-finite-number", title: "Invalid", completed: false }]
    })
  })

  await page.goto("/")

  await expect(page.getByRole("alert")).toContainText("Could not load todos.")
  await expect(page.getByRole("alert")).toContainText(
    "The API request failed. Check the network connection and try again."
  )
  await expect(page.getByRole("listitem")).toHaveCount(0)
})

test("recognizes cached data hidden by the active filter", async ({ page }) => {
  await denyUnexpectedNetwork(page)
  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    await route.fulfill({ json: openTodos })
  })
  await page.route(
    "https://jsonplaceholder.typicode.com/this-route-does-not-exist",
    async (route) => {
      await route.fulfill({ status: 404, json: {} })
    }
  )

  await page.goto("/")
  await expect(page.getByRole("listitem")).toHaveCount(2)

  await page.getByRole("button", { name: /^Done/ }).click()
  await expect(page.getByText("No todos match this filter.")).toBeVisible()
  await page.getByText("Use broken endpoint", { exact: true }).click()

  await expect(page.getByRole("alert")).toContainText("Refresh failed; showing cached data.")
  await expect(page.getByRole("listitem")).toHaveCount(0)
})
