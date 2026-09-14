---
"@osuki-dev/react-native-splash": patch
---

iOS: keep the overlay above a root view that arrives after launch. With expo-updates the React Native root view replaces a placeholder once the update check finishes; the overlay now moves into its `loadingView` slot when it appears and stays in front of the window until then. The manager also logs to the `dev.osuki.splash` os_log subsystem.
