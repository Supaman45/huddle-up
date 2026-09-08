// Regenerates .expo/types/router.d.ts, the typed-routes declaration Expo normally writes while
// `expo start` is running. Running it before tsc means a new file under src/app is a known route
// at typecheck time, whether or not a dev server has seen it yet. Without this, the gate fails on
// any machine that has not started the app since the route was added.
const path = require('path');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', { paths: [require.resolve('expo/package.json', { paths: [projectRoot] })] }));
  const { setupTypedRoutes } = require(path.join(cliRoot, 'build/src/start/server/type-generation/routes.js'));
  await setupTypedRoutes({
    projectRoot,
    routerDirectory: path.join(projectRoot, 'src/app'),
    typesDirectory: path.join(projectRoot, '.expo/types'),
    plugin: undefined,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
