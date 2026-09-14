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
`OnboardingIntro` calls it. Their first frame is the launch-screen mirror, so
the handoff stays seamless whichever one you pick. The example app switches
between all four at runtime through `SplashScreen.show()`.

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
  changed logo is picked up; if the simulator still shows the old art, reboot it.
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

Apache-2.0
