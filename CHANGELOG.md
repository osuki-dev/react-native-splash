# @osuki-dev/react-native-splash

## 0.2.2

### Patch Changes

- [#9](https://github.com/osuki-dev/react-native-splash/pull/9) [`e3ec30e`](https://github.com/osuki-dev/react-native-splash/commit/e3ec30ec07657e4c8ed812379e8f75425f3b9dc5) Thanks [@BANG88](https://github.com/BANG88)! - Android: a splash configured without an `image` now shows only the background colour. Without an explicit icon Android 12 falls back to the launcher icon, so a paper-only launch screen still flashed the app's mark before a themed overlay.

- [#9](https://github.com/osuki-dev/react-native-splash/pull/9) [`e3ec30e`](https://github.com/osuki-dev/react-native-splash/commit/e3ec30ec07657e4c8ed812379e8f75425f3b9dc5) Thanks [@BANG88](https://github.com/BANG88)! - Android: with no `image` configured, the plugin also removes Expo's template `drawable/ic_launcher_background.xml`, which references the splash logo it no longer writes and made `processReleaseResources` fail with `resource drawable/splashscreen_logo not found`.

## 0.2.1

### Patch Changes

- [#7](https://github.com/osuki-dev/react-native-splash/pull/7) [`e6aed84`](https://github.com/osuki-dev/react-native-splash/commit/e6aed84a3b281a59e0c60602c36f01e86363888e) Thanks [@BANG88](https://github.com/BANG88)! - Android: a splash configured without an `image` now shows only the background colour. Without an explicit icon Android 12 falls back to the launcher icon, so a paper-only launch screen still flashed the app's mark before a themed overlay.

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
