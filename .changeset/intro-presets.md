---
"@osuki-dev/react-native-splash": minor
---

feat(intros): add SplitCurtain, FeatureShowcase, ZoomFade, and ModernHero intro presets

- Keep all existing intros intact (`LogoRevealIntro`, `CircleRevealIntro`, `TypographicIntro`, `OnboardingIntro`)
- Add `SplitCurtainIntro` for cinematic split-screen handoffs (horizontal or vertical)
- Add `FeatureShowcaseIntro` for rich card-based staggered feature highlights with optional interactive tap-to-continue
- Add `ZoomFadeIntro` for spatial camera fly-through zoom transitions with ambient pulsing rings
- Add `ModernHeroIntro` for modern hero typography with tag pills and directional exit
- Enforce explicit 'worklet' directives and safe thread dispatch via `scheduleOnRN` to prevent UI thread crashes
