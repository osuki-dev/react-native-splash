---
"@osuki-dev/react-native-splash": minor
---

`SplashScreen.setLaunchImage({ uri, backgroundColor, darkBackgroundColor?, widthFraction, maxWidth, aspectRatio })` and `clearLaunchImage()`: from the next cold start on, the native overlay draws that picture on that paper instead of the compiled launch assets (a theme's own artwork, for example), and `getManifest().launchImage` lets `useSplashMirror` paint the identical first JS frame. The OS-drawn launch screen still shows the compiled assets for its first frames.
