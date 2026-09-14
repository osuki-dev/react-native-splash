import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

export interface LogoRevealIntroProps extends IntroProps {
  /** Colour of the ring that ripples out on exit. Default `#FF6B4A`. */
  ringColor?: string
  /** Exit duration in ms. Default 520. */
  exitDuration?: number
}

/**
 * The classic: the logo breathes while the app loads, then a ring ripples
 * out and everything scales up into transparency.
 */
export function LogoRevealIntro({ phase, finish, ringColor = '#FF6B4A', exitDuration = 520 }: LogoRevealIntroProps) {
  const mirror = useSplashMirror()
  const breathe = useSharedValue(1)
  const exit = useSharedValue(0)
  const ring = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      )
      return
    }
    if (phase !== 'exiting') return
    breathe.value = withTiming(1, { duration: 150 })
    ring.value = withTiming(1, { duration: exitDuration + 130, easing: Easing.out(Easing.cubic) })
    exit.value = withDelay(
      120,
      withTiming(1, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(finish)
      }),
    )
    // Shared values are stable; only the phase drives this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const container = useAnimatedStyle(() => ({ opacity: 1 - exit.value }))
  const logo = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * (1 + exit.value * 1.8) }],
    opacity: 1 - exit.value,
  }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.5 * (1 - ring.value),
    transform: [{ scale: 0.6 + ring.value * 3 }],
  }))

  const size = typeof mirror.logo.style.width === 'number' ? mirror.logo.style.width : 100
  return (
    <Animated.View style={[mirror.container.style, container]}>
      <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: ringColor }, ringStyle]} />
      {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} /> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2 },
})
