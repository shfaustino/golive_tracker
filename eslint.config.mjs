import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';

export default [
    {
        // deploy/approuter/webapp is what mbt build copies in (see mta.yaml),
        // not sources.
        ignores: [
            'dist/**', 'node_modules/**', 'webapp/localService/**',
            'deploy/approuter/webapp/**', 'deploy/approuter/node_modules/**',
            'mta_archives/**', '.*_mta_build_tmp/**'
        ]
    },
    ...fioriTools.configs.recommended,
    {
        // The Fiori tools preset declares ES5-era globals only; UI5 1.120 hands
        // promises back from its own APIs (OData V4 model, Fragment.load).
        files: ['webapp/**/*.js'],
        languageOptions: { globals: { Promise: 'readonly' } }
    },
    {
        // Unit tests and tools run in Node, not in the browser.
        files: ['test/**/*.js', 'tools/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { module: 'writable', require: 'readonly', __dirname: 'readonly', console: 'readonly', process: 'readonly' }
        }
    }
];
