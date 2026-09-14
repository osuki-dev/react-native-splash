import { createContext, useContext } from 'react'

import type { SplashRenderContext } from './types'

/** What `useSplashMirror` needs from the overlay to sequence the handoff. */
export interface SplashOverlayInternals {
  /**
   * Announce an asset the overlay must wait for before removing the native
   * splash. Returns the function to call once it has loaded (or failed).
   */
  registerAsset: () => () => void
}

export type SplashOverlayContextValue = SplashRenderContext & SplashOverlayInternals

export const SplashOverlayContext = createContext<SplashOverlayContextValue | null>(null)

/** The overlay's render context, for components rendered inside `<SplashOverlay>`. */
export function useSplashContext(): SplashRenderContext {
  const value = useContext(SplashOverlayContext)
  if (value === null) {
    throw new Error('[react-native-splash] useSplashContext must be used inside <SplashOverlay>')
  }
  return value
}
