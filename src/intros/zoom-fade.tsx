import { useEffect } from 'react'
import { StyleSheet, Text, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

export interface ZoomFadeIntroProps extends IntroProps {
  /** Optional badge or status text above the logo (e.g. "PRO", "AI INSIDE"). */
  badge?: string
  /** Brand headline or app title. */
  title?: string
  /** Tagline or subtitle below the title. */
  tagline?: string
  /**
   * Exit transition mode:
   * - `'zoom-in'`: Fly-through effect where the logo zooms forward into the camera.
   * - `'zoom-out'`: The logo and mark shrink into the distance.
   * Default `'zoom-in'`.
   */
  mode?: 'zoom-in' | 'zoom-out'
  /** Accent colour for the badge and glowing ambient rings. Default `#2D4FCB`. */
  accentColor?: string
  /** Custom title text colour. Defaults based on `colorScheme`. */
  textColor?: string
  /** Custom tagline colour. Defaults based on `colorScheme`. */
  taglineColor?: string
  /** Maximum scale factor when zooming forward on exit. Default 5. */
  maxZoomScale?: number
  /** Exit animation duration in ms. Default 480. */
  exitDuration?: number
}

/**
 * Spatial zoom & fly-through: the logo lands with a subtle elastic bounce,
 * surrounded by pulsing concentric ambient rings. On exit, the camera swoops
 * through the mark (or drops away) with an exponential zoom into the app.
 */
export function ZoomFadeIntro({
  phase,
  finish,
  colorScheme,
  badge,
  title,
  tagline,
  mode = 'zoom-in',
  accentColor = '#2D4FCB',
  textColor,
  taglineColor,
  maxZoomScale = 5,
  exitDuration = 480,
}: ZoomFadeIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  const enter = useSharedValue(0)
  const pulse = useSharedValue(1)
  const exit = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      enter.value = withDelay(80, withSpring(1, { damping: 12, stiffness: 140 }))
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      )
      return
    }
    if (phase !== 'exiting') return
    exit.value = withTiming(1, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exitDuration])

  const isDark = colorScheme === 'dark'
  const ink = textColor ?? (isDark ? '#E6EAF0' : '#1A2027')
  const muted = taglineColor ?? (isDark ? '#98A3B0' : '#5B6672')

  const logoBaseSize = typeof mirror.logo.style.width === 'number' && mirror.logo.style.width > 0
    ? mirror.logo.style.width
    : 100

  // Container style (background fade)
  const container = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 1 - exit.value,
    }
  })

  // Mark & ambient rings transform
  const markContainer = useAnimatedStyle(() => {
    'worklet'
    const scale = mode === 'zoom-in'
      ? interpolate(exit.value, [0, 1], [enter.value, maxZoomScale], Extrapolation.CLAMP)
      : interpolate(exit.value, [0, 1], [enter.value, 0.05], Extrapolation.CLAMP)

    return {
      transform: [{ scale }],
      opacity: interpolate(exit.value, [0, 0.75], [1, 0], Extrapolation.CLAMP),
    }
  })

  // Outer ambient ring pulse
  const outerRing = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ scale: pulse.value }],
      opacity: (1 - exit.value) * 0.45,
    }
  })

  // Inner ambient ring pulse
  const innerRing = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ scale: 1 + (pulse.value - 1) * 0.5 }],
      opacity: (1 - exit.value) * 0.7,
    }
  })

  // Typography & badge fade and slide
  const copyStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: enter.value * (1 - exit.value * 2),
      transform: [{ translateY: (1 - enter.value) * 24 + exit.value * 30 }],
    }
  })

  const outerSize = logoBaseSize * 2.2
  const innerSize = logoBaseSize * 1.55

  return (
    <Animated.View style={[mirror.container.style, container]}>
      {/* Concentric Ambient Rings behind the logo */}
      <Animated.View style={[styles.ringsWrapper, markContainer]}>
        <Animated.View
          style={[
            styles.ring,
            {
              width: outerSize,
              height: outerSize,
              borderRadius: outerSize / 2,
              borderColor: accentColor,
            },
            outerRing,
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              borderColor: accentColor,
            },
            innerRing,
          ]}
        />
      </Animated.View>

      {/* Logo in center */}
      {mirror.hasLogo ? (
        <Animated.Image {...mirror.logo} style={[mirror.logo.style, markContainer]} />
      ) : null}

      {/* Badge, Title and Tagline */}
      <Animated.View style={[styles.copyContainer, { top: height * 0.58, width }, copyStyle]}>
        {badge ? (
          <Animated.View
            style={[
              styles.badge,
              {
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}55`,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
          </Animated.View>
        ) : null}

        {title ? <Text style={[styles.title, { color: ink }]}>{title}</Text> : null}
        {tagline ? <Text style={[styles.tagline, { color: muted }]}>{tagline}</Text> : null}
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  ringsWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  copyContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
})
