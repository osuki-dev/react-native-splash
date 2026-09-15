---
'@osuki-dev/react-native-splash': patch
---

Android: with no `image` configured, the plugin also removes Expo's template `drawable/ic_launcher_background.xml`, which references the splash logo it no longer writes and made `processReleaseResources` fail with `resource drawable/splashscreen_logo not found`.
