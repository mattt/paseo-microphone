import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
  lint: {
    ignorePatterns: ["node_modules/**"],
    options: {
      typeAware: true,
    },
    rules: {
      // The Paseo SDK declares callbacks such as `rpc` with method syntax,
      // though they are bound functions.
      "typescript/unbound-method": "off",
    },
  },
  fmt: {
    ignorePatterns: ["node_modules/**", "package-lock.json"],
    printWidth: 100,
    overrides: [{ files: [".github/workflows/*.yml"], options: { tabWidth: 4 } }],
  },
});
