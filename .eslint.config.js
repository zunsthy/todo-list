module.exports = {
  extends: ["standard", "plugin:react/recommended", "preitter"],
  plugins: ["react"],
  env: {
    browser: true,
  },
  parser: "babel-eslint",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    emcaVertion: 2020,
  },
  rules: {},
};
