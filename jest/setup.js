// Add to jest.config: setupFiles: ['@osuki-dev/react-native-splash/jest/setup']
//
// The library degrades to no-ops when the Nitro hybrid object cannot be
// created, so all that is needed is a Nitro core that never creates one.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => {
      throw new Error('react-native-nitro-modules is mocked in tests')
    },
  },
}))
