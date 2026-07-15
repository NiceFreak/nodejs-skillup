import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/**', 'coverage/**', 'users.postman_collection.json', 'postman/**'],
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': [
                'warn',
                {
                    args: 'none',
                    caughtErrors: 'none',
                },
            ],
        },
    },
    {
        files: ['**/__tests__/**/*.js', '**/*.test.js'],
        languageOptions: {
            globals: globals.jest,
        },
    },
    {
        files: ['match-index-explain.js'],
        rules: {
            // Known W3 debt: this file still mixes mongosh globals with Node.js.
            'no-undef': 'warn',
        },
    },
    {
        files: ['node-server.js'],
        rules: {
            // Keep the old low-level demo visible without blocking current app linting.
            'no-useless-assignment': 'warn',
        },
    },
    eslintConfigPrettier,
];
