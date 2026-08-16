import { HydrationScript } from "@solidjs/web"
import type { ParentProps } from "solid-js"

export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f2efe5" />
        <meta
          name="description"
          content="A small data-fetching example using Effect, Effect Atom, and Solid."
        />
        <title>Effect Solid Data Lab</title>
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  )
}
