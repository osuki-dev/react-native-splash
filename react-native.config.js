// https://github.com/react-native-community/cli/blob/main/docs/dependencies.md
// https://github.com/react-native-community/cli/blob/main/docs/plugins.md

// The CLI evaluates this file for every dependency during autolinking, so the
// command implementation is only required when the command actually runs.
function loadCli() {
  return require('./cli/build/cli/src')
}

function commandOptions() {
  try {
    return loadCli().commandOptions
  } catch {
    return []
  }
}

module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {},
    },
  },
  commands: [
    {
      name: 'splash-generate',
      description:
        'Generate the native launch screen assets (storyboard, asset catalogs, Android drawables and theme) from splash.config.js or flags.',
      func: (argv, _config, options) => loadCli().run(argv, options),
      options: commandOptions(),
    },
  ],
}
