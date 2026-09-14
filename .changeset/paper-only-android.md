---
'@osuki-dev/react-native-splash': patch
---

Android: a splash configured without an `image` now shows only the background colour. Without an explicit icon Android 12 falls back to the launcher icon, so a paper-only launch screen still flashed the app's mark before a themed overlay.
