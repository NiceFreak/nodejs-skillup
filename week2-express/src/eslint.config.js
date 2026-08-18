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
            'no-console': 'error',
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
    {
        // D2 #7：主链路（app.js / server.js / config / controllers / routes / services / repositories / models / middlewares / errors / utils / __tests__）
        // 一律禁止裸 console.log（D1 §5.1 强制层）；种子与实验脚本确有打印需求，目录级放行，不进入主链路。
        files: [
            'seed.js',
            'seedOrders.js',
            'seedUsers.js',
            'findOrdersWithUser.js',
            'match-index-explain.js',
            'reports.js',
            'node-server.js',
            'server-deprecated.js',
            'perf/**/*.js',
        ],
        rules: {
            'no-console': 'off',
        },
    },
    eslintConfigPrettier,
    {
        files: ['**/*.js'],
        rules: {
            'no-multiple-empty-lines': [
                'warn',
                {
                    max: 1,
                    maxEOF: 0,
                },
            ],
        },
    },
];
