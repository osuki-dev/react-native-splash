import type { SplashLaunchImage } from './types'

/**
 * The box a launch image is drawn in: `min(width * fraction, maxWidth)` wide,
 * `aspectRatio` tall. The native overlays apply the same rule
 * (`SplashLaunchImageView` on iOS, `SplashOverlayView` on Android), which is
 * what keeps the handoff pixel-identical.
 *
 * Its own module, free of React Native imports, so it can be unit-tested.
 */
export function launchImageBox(image: SplashLaunchImage, windowWidth: number): { width: number; height: number } {
  const width = Math.min(windowWidth * image.widthFraction, image.maxWidth)
  const ratio = image.aspectRatio > 0 ? image.aspectRatio : 1
  return { width, height: width / ratio }
}
