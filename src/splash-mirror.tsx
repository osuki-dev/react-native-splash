import { useEffect, useRef } from 'react'
import { Animated, Image } from 'react-native'

import { useSplashContext } from './splash-context'
import { useSplashMirror } from './use-splash-mirror'

export interface SplashMirrorProps {
  /** Exit fade duration in ms. Default 300. */
  fadeDuration?: number
}

/**
 * The default overlay content: an exact replica of the native launch screen
 * that fades out when the overlay exits. Uses React Native's own `Animated`
 * so the library has no animation dependency; bring Reanimated for anything
 * more expressive (see README).
 */
export function SplashMirror({ fadeDuration = 300 }: SplashMirrorProps) {
  const { phase, finish } = useSplashContext()
  const mirror = useSplashMirror()
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (phase !== 'exiting') return
    const animation = Animated.timing(opacity, { toValue: 0, duration: fadeDuration, useNativeDriver: true })
    animation.start(() => finish())
    return () => animation.stop()
  }, [phase, fadeDuration, finish, opacity])

  return (
    <Animated.View style={[mirror.container.style, { opacity }]}>
      {mirror.hasLogo ? <Image {...mirror.logo} /> : null}
    </Animated.View>
  )
}
