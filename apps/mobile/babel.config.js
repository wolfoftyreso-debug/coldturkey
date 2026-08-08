/*
 * Note on `@babel/runtime`: this preset rewrites async/await and spread into
 * calls to helpers in that package, so it is a real runtime dependency of the
 * app rather than tooling. pnpm's strict layout does not hoist it, so it is
 * declared explicitly in package.json. Removing it leaves a project that
 * typechecks cleanly and then fails to bundle.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
  };
};
