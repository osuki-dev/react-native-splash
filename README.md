# @osuki-dev/react-native-splash

Splash and intro screens for React Native and Expo. The native launch screen
hands off to your own React view, pixel for pixel, and from there you animate
with Reanimated (or anything else) and render whatever you like: a logo
animation, a loading gate, a full onboarding flow.

- **No flash.** Native keeps the launch screen up until your JS overlay has
  been painted, then drops it in the same frame.
- **Nothing to edit natively.** No `AppDelegate`, no `MainActivity`. iOS
  attaches at launch through a load-time hook; Android through a content
  provider and activity lifecycle callbacks.
- **Expo and bare.** A config plugin for `expo prebuild`, a CLI for bare
  projects. Same options as `expo-splash-screen`, so migrating is a rename.
- **Your animation library.** The package has no animation dependency. It tells
  you *when* (`phase`) and you tell it when you are done (`finish()`).
- **Ready-made intros.** `@osuki-dev/react-native-splash/intros` ships four
  Reanimated intros (logo reveal, circle reveal, typographic, swipeable
  onboarding) that start from the exact launch-screen frame.
- **Nitro Modules**, Swift and Kotlin.

Requirements: React Native 0.78+ with the New Architecture (the only
architecture this library targets), iOS 15+, Android 7+ (API 24). Not
supported: the legacy architecture, Expo Go (native code), full-screen splash
images (Android 12+ only shows an icon; full-bleed art belongs in the JS
overlay).

## Install

```sh
npm install @osuki-dev/react-native-splash react-native-nitro-modules
```

Remove `expo-splash-screen` if you had it: both libraries claim the same
native slots and the config plugin refuses to run next to it.

### Expo

```jsonc
// app.json
{
  "expo": {
    "plugins": [
      ["@osuki-dev/react-native-splash", {
        "backgroundColor": "#F7F3EC",
        "image": "./assets/splash-icon.png",
        "imageWidth": 128,
        "dark": { "backgroundColor": "#050B12", "image": "./assets/splash-icon-dark.png" }
      }]
    ]
  }
}
```

Then `npx expo prebuild` and build a dev client or a release build.

### Bare React Native

```sh
npx react-native-splash generate --logo ./assets/splash-icon.png --logo-width 128 --background "#F7F3EC" --dark-background "#050B12"
# or keep the options in splash.config.js (same shape as the plugin options) and run
npx react-native-splash generate
```

It writes the storyboard, asset catalogs, Android drawables, colours, theme
and manifest entry, then `pod install` and rebuild.

## Use

```tsx
import { SplashOverlay, SplashScreen, useSplashMirror } from '@osuki-dev/react-native-splash'
import type { SplashRenderContext } from '@osuki-dev/react-native-splash'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// Module scope: React content can appear before the first effect runs.
SplashScreen.preventAutoHide()

function BrandSplash({ phase, finish }: SplashRenderContext) {
  const mirror = useSplashMirror() // background + logo props identical to the native launch screen
  const progress = useSharedValue(0)

  useEffect(() => {
    if (phase !== 'exiting') return
    progress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }, () => {
      scheduleOnRN(finish)
    })
  }, [phase])

  const container = useAnimatedStyle(() => ({ opacity: 1 - progress.value }))
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + progress.value * 0.4 }] }))

  return (
    <Animated.View style={[mirror.container.style, container]}>
      <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} />
    </Animated.View>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({ ... })
  return (
    <>
      <RootNavigator />
      <SplashOverlay ready={fontsLoaded} minimumDuration={400}>
        {(context) => <BrandSplash {...context} />}
      </SplashOverlay>
    </>
  )
}
```

### Ready-made intros

```sh
npm install react-native-reanimated react-native-worklets   # optional peers, only for this entry
```

```tsx
import { OnboardingIntro } from '@osuki-dev/react-native-splash/intros'

const [introDone, setIntroDone] = useState(false)

<SplashOverlay ready={fontsLoaded && introDone}>
  {(context) => (
    <OnboardingIntro
      {...context}
      onDone={() => setIntroDone(true)}
      pages={[{ title: 'Hello', body: '...', accent: '#FF6B4A' }, ...]}
    />
  )}
</SplashOverlay>
```

| Intro              | What it does                                                                 | Props                                             |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `LogoRevealIntro`  | Logo breathes while loading, ring ripples out, scales into transparency.     | `ringColor`, `exitDuration`                       |
| `CircleRevealIntro`| The background collapses into the logo, revealing the app from the edges.   |                                                   |
| `TypographicIntro` | Logo lifts, a tagline lands word by word, the sheet exits like a curtain.    | `words`, `textColor`, `textStyle`                 |
| `OnboardingIntro`  | Swipeable pages with parallax and dots; `onDone` fires on "Get started".     | `pages`, `nextLabel`, `startLabel`, `buttonColor`, `buttonTextColor` |

Every intro takes the overlay's render context plus `onDone`; only
`OnboardingIntro` calls it. For interactive intros pass `timeout={0}` (or a
generous value): the default 15 s cap exists for loading gates and would cut
a reader off mid-onboarding. Their first frame is the launch-screen mirror, so
the handoff stays seamless whichever one you pick. The example app switches
between all four at runtime through `SplashScreen.show()`.

#### First launch vs returning user

Which intro runs, and whether one runs at all, is app code. Read the flag
synchronously (MMKV, a Nitro store) so the decision is there on the first
render; every intro starts from the launch-screen mirror, so switching later
is possible but the synchronous path is seamless.

```tsx
const seenIntro = storage.getBoolean('intro.seen') ?? false

<SplashOverlay ready={fontsLoaded && (seenIntro || introDone)} timeout={seenIntro ? 15_000 : 0}>
  {(ctx) =>
    seenIntro ? (
      <LogoRevealIntro {...ctx} />
    ) : (
      <OnboardingIntro
        {...ctx}
        onDone={() => {
          storage.set('intro.seen', true)
          setIntroDone(true)
        }}
      />
    )
  }
</SplashOverlay>
```

`SplashScreen.getLaunchInfo()` adds `coldStart`, `reload` and
`systemSplashShown` for decisions that depend on how the app was started.

Without children, `<SplashOverlay>` renders `<SplashMirror />`, an exact
replica of the launch screen that fades out. Without `<SplashOverlay>` at
all, the native overlay hides itself when React content first appears, like
`expo-splash-screen`.

### Phases

| Phase     | What is on screen                                   | How it ends                                             |
| --------- | --------------------------------------------------- | ------------------------------------------------------- |
| `native`  | The native overlay (the launch storyboard / theme). | Your overlay painted; native removed without a fade.    |
| `visible` | Your overlay, interactive. Intro flows live here.   | `ready` and `minimumDuration`, or `timeout`, or an error. |
| `exiting` | Your exit animation. Touches pass through.          | You call `finish()`, or `exitTimeout` (2 s) elapses.    |
| `hidden`  | The app.                                            |                                                         |

### `SplashOverlay` props

| Prop                      | Default | Purpose                                                                 |
| ------------------------- | ------- | ----------------------------------------------------------------------- |
| `ready`                   | `true`  | Gate. Bind it to fonts, settings, auth, or "the user tapped Get started". |
| `minimumDuration`         | `0`     | Minimum ms on screen after the handoff.                                 |
| `timeout`                 | `15000` | Hard cap after the handoff; `0` disables.                               |
| `exitTimeout`             | `2000`  | Unmount if the render prop never calls `finish()`.                      |
| `skipWithoutSystemSplash` | `false` | Android: skip straight to `hidden` when the OS drew no launch screen.   |
| `onPhaseChange`, `onHidden` |       | Callbacks.                                                              |
| `style`                   |         | Extra styles for the full-screen container.                             |

### `SplashScreen`

`preventAutoHide()`, `hide({ fade?, duration? })`, `show()`, `isVisible()`,
`getPhase()`, `getManifest()`, `getLaunchInfo()`, `addListener(event, cb)`.

Events: `phase`, `nativeHidden`, `hidden` (with `durationMs`, a good
"first screen usable" metric), `timeout`, `error`.

`getLaunchInfo()` reports `coldStart`, `reload` (dev reload),
`systemSplashShown` (Android 12+: false when started from a notification or
widget), timestamps and the colour scheme at launch.

### Launch image (themes, personalisation)

The compiled launch assets are what the OS draws for the first frames of a
cold start; nothing changes that at runtime. Everything the library draws
after them can be replaced:

```ts
SplashScreen.setLaunchImage({
  uri: 'file:///…/hero.png',      // an image on disk
  backgroundColor: '#1B1F2A',      // its paper, light and dark
  darkBackgroundColor: '#0B0D12',
  widthFraction: 0.74,             // box width as a fraction of the window width…
  maxWidth: 560,                   // …capped in points / dp
  aspectRatio: 2,                  // box width / height
})
SplashScreen.clearLaunchImage()    // back to the compiled assets
```

From the next cold start on, the native overlay shows that picture on that
paper the moment the OS launch screen ends, `getManifest().launchImage`
reports it, and `useSplashMirror()` paints the identical first JS frame
(`launchImageBox()` is the shared sizing rule). Persisted natively, so it is
there before JavaScript is.

### `useSplashMirror()`

Returns `{ container, logo, hasLogo, backgroundColor, manifest }` prop bags
to spread onto any `View` / `Image` (Reanimated, expo-image). It applies dark
mode, the Samsung One UI icon scale and, on non edge-to-edge Android apps,
the system bar insets, and it delays the native handoff until the logo has
loaded.

## Plugin / CLI options

| Option            | Default     | Notes                                                                  |
| ----------------- | ----------- | ---------------------------------------------------------------------- |
| `backgroundColor` | `#ffffff`   | Opaque hex.                                                            |
| `image`           |             | Square PNG, 1024x1024 recommended.                                     |
| `imageWidth`      | `100`       | Logical width in points / dp. Android refuses > 192, warns > 134.      |
| `dark`            |             | `{ backgroundColor, image }`. Forces `UIUserInterfaceStyle=Automatic`. |
| `autoHide`        | `true`      | Hide native when React content appears (unless prevented).            |
| `hideTimeout`     | `15000`     | Native safety cap in ms; `0` disables.                                 |
| `ios.tabletImage` |             | iPad logo.                                                             |
| `android.postTheme` | `AppTheme` | Theme the activity switches to after the splash.                      |
| `ios.*`, `android.*` |          | Per-platform overrides of the root values.                             |

## Things worth knowing

- **Test in a dev client or release build.** Expo Go cannot load Nitro, and the
  dev client shows its own launch UI.
- **iOS caches the launch snapshot.** Asset names carry a content hash so a
  changed logo is picked up. The simulator's renderer (`splashboardd`) also
  caches the asset catalog per bundle id, so after a rebuild it can draw the
  background without the logo; restart it with
  `xcrun simctl spawn booted launchctl kickstart -k system/com.apple.splashboard`
  (or reboot the simulator) and reinstall.
- **Unsigned simulator builds launch black on iOS 26.** The system refuses to
  render a launch storyboard from a bundle without a code-signature seal
  (`Security error -67056`, then the app is denylisted for launch images), so
  the app-open animation is black until the overlay attaches. Builds from
  `expo run:ios` are signed; if yours is not (`CODE_SIGNING_ALLOWED=NO`),
  `codesign --force --deep --sign - App.app` before installing. Devices are
  never affected.
- **Android 12+ only shows an icon.** `imageWidth` is the logo size inside a
  288 dp canvas. Warm starts do show the splash; launches from a notification
  or widget may not (`launchInfo.systemSplashShown`).
- **API 24–28** cannot swap the theme before `onCreate` without a hook. If you
  need identical behaviour there, call `SplashScreenManager.install(this)` in
  `MainActivity.onCreate` before `super.onCreate`.
- **Reduce Motion**: Reanimated finishes animations instantly and still calls
  the completion, so `finish()` runs and nothing gets stuck.
- **Jest**: add `setupFiles: ['@osuki-dev/react-native-splash/jest/setup']`;
  every API becomes a no-op that resolves.
- **E2E**: keep `timeout` on, or mount the overlay behind a flag.

## Development

```sh
bun install
bun run specs        # nitrogen
bun run typecheck && bun test src plugin && bun run build
cd example && bun install && bun run prebuild && bun run ios
```

Releases follow changesets: add one with `bun run changeset`, merge the
"Version Packages" PR, and CI publishes with npm trusted publishing.

## License

MIT
