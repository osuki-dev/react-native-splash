/**
 * Ready-made intros built on react-native-reanimated (an optional peer).
 * Import from `@osuki-dev/react-native-splash/intros`; the main entry stays
 * free of any animation dependency.
 *
 * All of them render the exact launch-screen mirror as their first frame and
 * only start moving once the native overlay is gone.
 */
export { LogoRevealIntro } from './logo-reveal'
export type { LogoRevealIntroProps } from './logo-reveal'
export { CircleRevealIntro } from './circle-reveal'
export { TypographicIntro } from './typographic'
export type { TypographicIntroProps } from './typographic'
export { OnboardingIntro } from './onboarding'
export type { OnboardingIntroProps, OnboardingPage } from './onboarding'
export type { IntroProps } from './types'
