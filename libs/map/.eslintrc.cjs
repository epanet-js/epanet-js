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
      extends: [
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
      ],
      rules: {
        "unused-imports/no-unused-imports": "error",
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/no-floating-promises": 1,
        // Rendering code reaches into mapbox internals via casts; mirror the app's
        // tolerance for the resulting `any` flow rather than the strict defaults.
        "@typescript-eslint/no-unsafe-member-access": 0,
        "@typescript-eslint/no-unsafe-assignment": 0,
        "@typescript-eslint/no-unsafe-argument": 0,
        "@typescript-eslint/no-unsafe-call": 1,
        "@typescript-eslint/no-unsafe-return": 1,
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
