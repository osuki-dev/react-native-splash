# @osuki-dev/react-native-splash

## 0.1.2

### Patch Changes

- [#3](https://github.com/osuki-dev/react-native-splash/pull/3) [`21650bc`](https://github.com/osuki-dev/react-native-splash/commit/21650bc7b43cc9a82c2ee8820d29a33679d1d206) Thanks [@BANG88](https://github.com/BANG88)! - iOS: keep the overlay above a root view that arrives after launch. With expo-updates the React Native root view replaces a placeholder once the update check finishes; the overlay now moves into its `loadingView` slot when it appears and stays in front of the window until then. The manager also logs to the `dev.osuki.splash` os_log subsystem.

## 0.1.1

### Patch Changes

- Thanks [@BANG88](https://github.com/BANG88)! - Relicense under MIT.

## 0.1.0

### Minor Changes

- Thanks [@BANG88](https://github.com/BANG88)! - Initial release: native launch-screen handoff for React Native and Expo on Nitro Modules (Swift + Kotlin), `<SplashOverlay>` with a pure phase state machine, `useSplashMirror` for pixel-identical JS overlays, an Expo config plugin and a bare React Native CLI that generate the storyboard, asset catalogs, Android drawables and theme.
