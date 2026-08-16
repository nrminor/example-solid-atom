import solid from "@solidjs/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [solid({ start: true })],
  build: {
    target: "esnext",
    minify: "oxc",
    modulePreload: { polyfill: false },
    rolldownOptions: {
      treeshake: {
        annotations: true,
        commonjs: true,
        propertyReadSideEffects: false
      }
    }
  }
})
