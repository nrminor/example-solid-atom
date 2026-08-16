/** @satisfies {import("stylelint").Config} */
const config = {
  extends: ["stylelint-config-recommended"],
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  reportUnscopedDisables: true,
  rules: {
    "no-descending-specificity": null
  }
}

export default config
