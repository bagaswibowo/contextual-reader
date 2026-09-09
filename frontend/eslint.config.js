export default [
  {
    rules: { "no-undef": "error" },
    languageOptions: {
      globals: { window: "readonly", document: "readonly", setTimeout: "readonly", encodeURIComponent: "readonly", Promise: "readonly", Math: "readonly", Set: "readonly", Array: "readonly", console: "readonly", fetch: "readonly", SpeechSynthesisUtterance: "readonly", Audio: "readonly", clearInterval: "readonly", setInterval: "readonly" }
    }
  }
];
