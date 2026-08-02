import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    {
        // ui-prototype is a standalone Vite app with its own toolchain (oxlint,
        // its own tsconfig) — it is not an npm workspace member and is linted
        // independently, not by this root config.
        ignores: [
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/node_modules/**',
            '**/.venv/**',
            '**/__pycache__/**',
            'ui-prototype/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            globals: { ...globals.node },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            'no-console': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                { allowExpressions: true },
            ],
        },
    },
    {
        // Composition roots log to the console before a logger exists.
        files: ['**/server.ts', '**/main.ts'],
        rules: { 'no-console': 'off' },
    },
    {
        // Config and scripts are plain JS / not part of the type-checked project.
        files: ['**/*.mjs', '**/*.config.{js,mjs,ts}'],
        extends: [tseslint.configs.disableTypeChecked],
        rules: {
            'no-console': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
    prettier,
);
