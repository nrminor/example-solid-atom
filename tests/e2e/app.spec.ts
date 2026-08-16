import { expect, test } from "@playwright/test"

const todos = [
  { userId: 1, id: 1, title: "Write the Effect", completed: false },
  { userId: 1, id: 2, title: "Decode the response", completed: true },
  { userId: 1, id: 3, title: "Render the atoms", completed: false },
  { userId: 1, id: 4, title: "Verify the result", completed: true }
]

test("renders and filters decoded todos without refetching", async ({ page }) => {
  let requestCount = 0

  await page.route("https://jsonplaceholder.typicode.com/todos**", async (route) => {
    requestCount += 1
    await route.fulfill({ json: todos })
  })

  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "One request. Every state accounted for." })
  ).toBeVisible()
  await expect(page.getByRole("listitem")).toHaveCount(4)
  await expect(page.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true")

  await page.getByRole("button", { name: /^Open/ }).click()

  await expect(page.getByRole("listitem")).toHaveCount(2)
  await expect(page.getByRole("button", { name: /^Open/ })).toHaveAttribute("aria-pressed", "true")
  expect(requestCount).toBe(1)
})
