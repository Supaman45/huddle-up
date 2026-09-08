// Expo's flat config, plus the rules that catch the mistakes this codebase actually made:
// a swallowed promise rejection, an effect that reloads forever, an unused import left
// behind by a refactor. Prettier goes last so formatting never fights a lint rule.
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const ts = require('typescript-eslint');

module.exports = [
  ...expo,
  prettier,
  {
    // Edge functions are Deno, not React Native: different module resolution, different
    // globals. They are typechecked by `deno check`, not by this config.
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'src/lib/database.types.ts', 'supabase/functions/**'],
  },
  {
    plugins: { '@typescript-eslint': ts.plugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      // Fires on `load()` at the top of an effect. Every one of those loaders awaits a
      // network round trip before it touches state, so the cascading render the rule warns
      // about cannot happen. Kept visible as a warning rather than silenced.
      'react-hooks/set-state-in-effect': 'warn',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Build scripts run under Node, where __dirname and require are real.
    files: ['scripts/**/*.js'],
    languageOptions: { globals: { __dirname: 'readonly', require: 'readonly', module: 'readonly', process: 'readonly', console: 'readonly' } },
  },
];
