import type { SplashRenderContext } from '../types'

/**
 * Every ready-made intro takes the overlay's render context plus `onDone`.
 *
 * ```tsx
 * <SplashOverlay ready={fontsLoaded && introDone}>
 *   {(context) => <OnboardingIntro {...context} onDone={() => setIntroDone(true)} />}
 * </SplashOverlay>
 * ```
 *
 * Non-interactive intros never call `onDone`; bind `ready` to your loading
 * state instead.
 */
export interface IntroProps extends SplashRenderContext {
  /** The user finished the intro (tapped "Get started" or action button). Optional for non-interactive intros. */
  onDone?: () => void
}
