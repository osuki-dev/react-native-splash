# @osuki-dev/react-native-splash

## 0.2.0

### Minor Changes

- [#5](https://github.com/osuki-dev/react-native-splash/pull/5) [`6c123b1`](https://github.com/osuki-dev/react-native-splash/commit/6c123b1f5fbd4a5b8cadb886e64c09afdc3c6366) Thanks [@BANG88](https://github.com/BANG88)! - `SplashScreen.setLaunchImage({ uri, backgroundColor, darkBackgroundColor?, widthFraction, maxWidth, aspectRatio })` and `clearLaunchImage()`: from the next cold start on, the native overlay draws that picture on that paper instead of the compiled launch assets (a theme's own artwork, for example), and `getManifest().launchImage` lets `useSplashMirror` paint the identical first JS frame. The OS-drawn launch screen still shows the compiled assets for its first frames.

## 0.1.2

### Patch Changes

- [#3](https://github.com/osuki-dev/react-native-splash/pull/3) [`21650bc`](https://github.com/osuki-dev/react-native-splash/commit/21650bc7b43cc9a82c2ee8820d29a33679d1d206) Thanks [@BANG88](https://github.com/BANG88)! - iOS: keep the overlay above a root view that arrives after launch. With expo-updates the React Native root view replaces a placeholder once the update check finishes; the overlay now moves into its `loadingView` slot when it appears and stays in front of the window until then. The manager also logs to the `dev.osuki.splash` os_log subsystem.

## 0.1.1

### Patch Changes

- Thanks [@BANG88](https://github.com/BANG88)! - Relicense under MIT.

## 0.1.0

### Minor Changes

- Thanks [@BANG88](https://github.com/BANG88)! - Initial release: native launch-screen handoff for React Native and Expo on Nitro Modules (Swift + Kotlin), `<SplashOverlay>` with a pure phase state machine, `useSplashMirror` for pixel-identical JS overlays, an Expo config plugin and a bare React Native CLI that generate the storyboard, asset catalogs, Android drawables and theme.
