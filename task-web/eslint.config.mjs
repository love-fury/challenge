import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "artifacts/**",
      "tmp/**",
      "src/hancom/discovery/**",
      "examples/discovery/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "complexity": ["error", 10],
      "max-depth": ["error", 4],
      "max-lines": [
        "error",
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      "max-lines-per-function": [
        "error",
        {
          max: 70,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true
        }
      ],
      "no-duplicate-imports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports"
        }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error"
    }
  },
  {
    files: ["examples/**/*.ts", "tests/**/*.ts"],
    rules: {
      "complexity": "off",
      "max-lines": [
        "error",
        {
          max: 400,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      "max-lines-per-function": [
        "error",
        {
          max: 120,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true
        }
      ]
    }
  },
  {
    files: ["src/hancom/pageFunctions.ts"],
    rules: {
      "complexity": "off",
      "max-lines": "off",
      "max-lines-per-function": "off"
    }
  },
  {
    files: ["src/hancom/hwpJson20.ts"],
    rules: {
      "complexity": "off",
      "max-lines": "off",
      "max-lines-per-function": "off"
    }
  },
  {
    files: ["src/hancom/discovery/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off"
    }
  },
  {
    files: ["src/hancom/HancomBridge.ts", "src/models/types.ts"],
    rules: {
      "complexity": "off",
      "max-lines": "off"
    }
  }
);
