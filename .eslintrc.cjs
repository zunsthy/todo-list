module.exports = {
  extends: [
    "standard",
    "plugin:react/recommended",
    "prettier",
  ],
  plugins: [
    "react",
  ],
  env: {
    browser: true,
  },
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    emcaVertion: 2020,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {},
};
