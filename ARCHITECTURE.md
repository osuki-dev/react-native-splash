# Architecture

`@osuki-dev/react-native-splash` does one thing: it keeps the OS launch screen
on screen until a React view that looks exactly like it has been painted, then
gets out of the way. Everything after that (animation, loading gates, intro
flows) is the app's React code.

```
 OS            system launch screen (storyboard / Android 12 icon)
   │
 native        library overlay, attached before JS exists         ios/SplashScreenManager.swift
   │           (iOS: storyboard instance in RN's loadingView slot; android/.../SplashScreenManager.kt
   │            Android: decor-view copy of the theme, system view
   │            removed the moment its exit listener fires)
   │
 Nitro         HybridSplashScreen: thin adapter, one event callback  ios/HybridSplashScreen.swift
   │                                                                 android/.../HybridSplashScreen.kt
 JS            SplashScreen (imperative) + <SplashOverlay> state    src/splash-screen.ts
   │           machine + useSplashMirror prop bags                   src/splash-overlay.tsx, src/use-splash-mirror.ts
   │
 app           user render prop: Reanimated, intro, anything
```

## Launch sequence

1. **Process start.** iOS shows `UILaunchStoryboardName`; Android 12+ draws
   the icon from the manifest theme, older Android draws the theme's
   `windowBackground`.
2. **Native overlay attaches.**
   - iOS: `SplashLaunchHook.m` runs in `+load`, waits for
     `UIApplicationDidFinishLaunchingNotification` (posted after the app
     delegate returns, by which time RN's window and root view exist) and
     calls `SplashScreenManager.applicationDidFinishLaunching()`. The manager
     instantiates the launch storyboard and hands the view to
     `RCTSurfaceHostingProxyRootView` through `disableActivityIndicatorAutoHide:`
     and `setLoadingView:`, reached via the Objective-C runtime so the pod needs
     no React headers. `setLoadingView:` re-creates the indicator view when it is
     already visible, which is why a late attach works. Scene-based apps get a
     second chance on `UIWindowDidBecomeKeyNotification`; hosts without the RN
     root view get a window-level subview instead.
   - Android: `SplashScreenInitProvider` (a content provider, created before
     `Application.onCreate`) registers activity lifecycle callbacks. For every
     `ReactActivity`: `onActivityPreCreated` (API 29+) reads the splash theme
     attributes, switches the activity to `postSplashScreenTheme` and, on 31+,
     arms `setOnExitAnimationListener` to remove the system view immediately.
     `onActivityCreated` (after RN's `setContentView`) adds `SplashOverlayView`,
     drawn from the same attributes, to the decor view and sets a plain colour
     window background.
3. **React starts.** Content mounts under the overlay. `<SplashOverlay>` calls
   `preventAutoHide()` during its first render, which is before Fabric mounts
   anything, so native's "content appeared" auto-hide does not fire.
4. **Handoff.** The overlay waits for its container `onLayout` and every asset
   registered through `useSplashMirror` (the logo's `onLoadEnd`), then two
   `requestAnimationFrame`s, then `hide({ fade: false })`. Native removes its
   view synchronously; the JS mirror underneath is identical. On iOS a 350 ms
   guard after attach delays hides that would land while the system launch
   screen is still cross-fading.
5. **Visible.** `ready`, `minimumDuration`, `timeout` and error signals feed the
   pure reducer in `src/splash-phase.ts`. Intro content lives here and is
   interactive.
6. **Exiting.** The render prop animates; `finish()` or `exitTimeout` ends it.
   The container ignores touches meanwhile.
7. **Hidden.** The overlay unmounts and emits `hidden` with the total duration.

## Layers

### Native managers

Both managers are process singletons that exist before JS and survive dev
reloads. They own: the overlay view, a queue for `hide` calls that arrive
before attach, the auto-hide flag, a safety timeout from the manifest, the
"JS failed to load" hide (iOS), the reload re-show (iOS via
`RCTTriggerReloadCommandNotification`), and the launch info counters
(`showCount`, `contentAppearedCount`).

Android specifics: the exit listener is cleared in `onActivityStopped` on API
31–33 (SurfaceControl crash, issuetracker 242118185); `systemSplashShown` is
true only when the exit listener fired; `logoSizeRatio` is 0.5 on Samsung One
UI 4+, where the OS draws the icon at half size.

### Manifest

The config plugin / CLI writes what it generated into native resources
(`Info.plist` `OsukiSplash` dict, `res/values/osuki_splash.xml`, the theme
attributes) and the managers expose it as `manifest`. JS therefore never
duplicates colours or sizes, and the logo is loaded by resource name
(`{ uri: 'SplashScreenLogo-<hash>' }` / `{ uri: 'splashscreen_logo' }`), not
bundled twice.

### Nitro spec (`src/specs/SplashScreen.nitro.ts`)

Two readonly struct properties, five methods, one event callback. Native
stores exactly one JS closure; `src/splash-screen.ts` fans it out to
`addListener` subscribers. Every method is safe to call from any thread and
before native has attached.

### JS

- `splash-screen.ts`: the `SplashScreen` object. Degrades to no-ops when the
  hybrid object cannot be created (Jest, Expo Go). Installs a fatal-error
  handler while an overlay is mounted so a crash never leaves the splash up.
- `splash-phase.ts`: the reducer. Never skips a phase, so every transition is
  observable.
- `splash-overlay.tsx`: timers, asset accounting, handoff, context.
- `use-splash-mirror.ts`: prop bags. Registers the logo as a pending asset.
- `splash-mirror.tsx`: default content, RN `Animated` fade, no Reanimated.

### Intros (`src/intros`, entry `@osuki-dev/react-native-splash/intros`)

Ready-made overlays on react-native-reanimated, published as a separate
entry (`intros/package.json` points Metro at `src/intros/index.ts`) so the
main entry keeps no animation dependency; Reanimated and worklets are
optional peers. Each intro takes `IntroProps` (the render context plus
`onDone`), renders the mirror as its first frame, starts moving on `visible`
and calls `finish()` from its exit animation's completion callback via
`scheduleOnRN`.

### Config plugin and CLI

`plugin/src/generate/*` is shared and has no Expo dependency: image resizing
through `@expo/image-utils`, the storyboard template, asset-catalog JSON,
Android density drawables (logo centred on a transparent 288 dp canvas), and
the runtime resource file. `plugin/src/with-*.ts` wraps it in Expo mods;
`cli/src/index.ts` wraps it in file edits for bare projects (Info.plist via
`@expo/plist`, pbxproj via `xcode`, XML via small text upserts). iOS asset
names carry a content hash to defeat the launch-snapshot cache.

## Decisions

- **New Architecture only.** Reanimated 4 and Nitro Views already require
  it; the iOS attach path targets `RCTSurfaceHostingProxyRootView` and only
  falls back to a window subview for hosts without that view.
- **Reanimated is not a dependency of the main entry.** Reanimated 4 needs
  the worklets Babel plugin last; owning that would push the constraint onto
  every user. `phase` in, `finish()` out keeps it in user land, and the
  `/intros` entry opts in explicitly.
- **Native never calls a JS listener it cannot trust.** The stored callback is
  dropped whenever a JS runtime starts or fails to load (dev reload), and the
  Android emit is wrapped so a dead callback cannot take the main thread down.
- **Native overlay, not `setKeepOnScreenCondition`.** Holding the first draw
  blocks the JS mirror from being painted underneath; owning a copy of the
  splash lets the app draw freely and gives us `show()` on Android too.
- **Storyboard instantiated, never redrawn in code.** The only way to be
  pixel-identical to the system snapshot.
- **Zero native edits by default**, explicit `install` hooks for the cases
  where the automatic path is best-effort (API 24–28 theme swap, custom iOS
  root view factories).
- **Auto-hide on by default**, like expo-splash-screen, so the package is
  useful without the overlay component.
