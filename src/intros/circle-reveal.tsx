import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

/**
 * The background is a huge circle centred on the logo. On exit it collapses
 * into the logo, which pops and vanishes, so the app is revealed from the
 * edges inward.
 */
export function CircleRevealIntro({ phase, finish }: IntroProps) {
  const mirror = useSplashMirror()
  const { width, height } = useWindowDimensions()
  // Large enough to cover the corners in every orientation.
  const diameter = Math.ceil(Math.hypot(width, height)) * 1.1

  const pop = useSharedValue(1)
  const collapse = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      pop.value = withDelay(100, withSpring(1.15, { damping: 9, stiffness: 150 }))
      return
    }
    if (phase !== 'exiting') return
    pop.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.back(1.6)) })
    collapse.value = withTiming(1, { duration: 620, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const circle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - collapse.value }],
  }))
  const logo = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    opacity: pop.value,
  }))

  return (
    // Transparent container: only the circle carries the splash colour.
    <Animated.View style={[mirror.container.style, styles.transparent]}>
      <Animated.View
        style={[
          styles.circle,
          { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: mirror.backgroundColor },
          circle,
        ]}
      />
      {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} /> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  transparent: { backgroundColor: 'transparent' },
  circle: { position: 'absolute' },
})
