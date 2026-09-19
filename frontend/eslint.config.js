export default [
  {
    files: ["src/**/*.{js,jsx}"],
    rules: { "no-undef": "error" },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly", document: "readonly", setTimeout: "readonly",
        encodeURIComponent: "readonly", Promise: "readonly", Math: "readonly",
        Set: "readonly", Array: "readonly", console: "readonly", fetch: "readonly",
        SpeechSynthesisUtterance: "readonly", Audio: "readonly",
        clearInterval: "readonly", setInterval: "readonly", alert: "readonly",
        localStorage: "readonly", FormData: "readonly", requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly", performance: "readonly"
      }
    }
  }
];
