import globals from "globals";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    rules: { "no-undef": "error" },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser
      }
    }
  }
];
