module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["plugin:prettier/recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "unused-imports", "prettier"],
  overrides: [
    {
      files: ["*.ts"],
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
      extends: ["plugin:@typescript-eslint/recommended-requiring-type-checking"],
      rules: {
        "unused-imports/no-unused-imports": "error",
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/no-floating-promises": 1,
      },
    },
    {
      files: [".eslintrc.js", "*.config.js"],
      env: {
        commonjs: true,
        node: true,
      },
    },
  ],
};
