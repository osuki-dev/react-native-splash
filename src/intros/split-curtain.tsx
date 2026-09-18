import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

export interface SplitCurtainIntroProps extends IntroProps {
  /**
   * Split orientation:
   * - `'vertical'`: Top and bottom panels slide apart.
   * - `'horizontal'`: Left and right panels slide apart.
   * Default `'vertical'`.
   */
  direction?: 'vertical' | 'horizontal'
  /** Optional badge pill above the logo (e.g. "WELCOME" or "v2.0"). */
  badge?: string
  /** Brand or app title below the logo. */
  title?: string
  /** Tagline or subtitle below the title. */
  subtitle?: string
  /** Accent colour for the badge and the dividing beam. Default `#FF6B4A`. */
  accentColor?: string
  /** Custom text colour. Defaults according to `colorScheme`. */
  textColor?: string
  /** Custom subtitle colour. Defaults according to `colorScheme`. */
  subtitleColor?: string
  /** Duration of the split exit in ms. Default 650. */
  exitDuration?: number
  /** Additional custom content to render in the center column. */
  children?: ReactNode
}

/**
 * Theatrical split-screen: the native splash is mirrored seamlessly across two
 * panels. On exit, the panels split apart like theatre doors or cinema shutters,
 * while the center brand mark smoothly zooms and dissolves into the app.
 */
export function SplitCurtainIntro({
  phase,
  finish,
  colorScheme,
  direction = 'vertical',
  badge,
  title,
  subtitle,
  accentColor = '#FF6B4A',
  textColor,
  subtitleColor,
  exitDuration = 650,
  children,
}: SplitCurtainIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  const enter = useSharedValue(0)
  const exit = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      enter.value = withDelay(100, withSpring(1, { damping: 15, stiffness: 120 }))
      return
    }
    if (phase !== 'exiting') return
    exit.value = withTiming(1, { duration: exitDuration, easing: Easing.inOut(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exitDuration])

  const isDark = colorScheme === 'dark'
  const ink = textColor ?? (isDark ? '#E6EAF0' : '#1A2027')
  const muted = subtitleColor ?? (isDark ? '#98A3B0' : '#5B6672')

  // Top / Left panel style
  const firstPanelStyle = useAnimatedStyle(() => {
    'worklet'
    if (direction === 'horizontal') {
      return {
        transform: [{ translateX: -exit.value * (width * 0.55) }],
      }
    }
    return {
      transform: [{ translateY: -exit.value * (height * 0.55) }],
    }
  })

  // Bottom / Right panel style
  const secondPanelStyle = useAnimatedStyle(() => {
    'worklet'
    if (direction === 'horizontal') {
      return {
        transform: [{ translateX: exit.value * (width * 0.55) }],
      }
    }
    return {
      transform: [{ translateY: exit.value * (height * 0.55) }],
    }
  })

  // Center mark and content
  const centerStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        { scale: 1 + exit.value * 0.18 },
        { translateY: -exit.value * 20 },
      ],
      opacity: interpolate(exit.value, [0, 0.65], [1, 0], Extrapolation.CLAMP),
    }
  })

  // Content enter style
  const contentStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: enter.value,
      transform: [{ translateY: (1 - enter.value) * 16 }],
    }
  })

  // Center dividing beam
  const dividerStyle = useAnimatedStyle(() => {
    'worklet'
    const scaleFactor = Math.max(0, 1 - exit.value * 2.5) * enter.value
    return {
      opacity: (1 - exit.value * 2) * enter.value * 0.75,
      transform: [direction === 'horizontal' ? { scaleY: scaleFactor } : { scaleX: scaleFactor }],
    }
  })

  const halfWidth = Math.ceil(width / 2) + 1
  const halfHeight = Math.ceil(height / 2) + 1

  return (
    <View style={[mirror.container.style, styles.container]}>
      {/* Panel 1: Top or Left */}
      <Animated.View
        style={[
          direction === 'horizontal'
            ? [styles.horizontalPanel, { left: 0, width: halfWidth, backgroundColor: mirror.backgroundColor }]
            : [styles.verticalPanel, { top: 0, height: halfHeight, backgroundColor: mirror.backgroundColor }],
          firstPanelStyle,
        ]}
      />

      {/* Panel 2: Bottom or Right */}
      <Animated.View
        style={[
          direction === 'horizontal'
            ? [styles.horizontalPanel, { right: 0, width: halfWidth, backgroundColor: mirror.backgroundColor }]
            : [styles.verticalPanel, { bottom: 0, height: halfHeight, backgroundColor: mirror.backgroundColor }],
          secondPanelStyle,
        ]}
      />

      {/* Subtle dividing light beam between panels */}
      <Animated.View
        style={[
          direction === 'horizontal'
            ? [styles.verticalDivider, { left: Math.floor(width / 2), backgroundColor: accentColor }]
            : [styles.horizontalDivider, { top: Math.floor(height / 2), backgroundColor: accentColor }],
          dividerStyle,
        ]}
      />

      {/* Centered Brand & Content */}
      <Animated.View style={[styles.center, centerStyle]}>
        {badge ? (
          <Animated.View
            style={[
              styles.badge,
              { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}18` },
              contentStyle,
            ]}
          >
            <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
          </Animated.View>
        ) : null}

        {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={mirror.logo.style} /> : null}

        {title || subtitle ? (
          <Animated.View style={[styles.copy, contentStyle]}>
            {title ? <Text style={[styles.title, { color: ink }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text> : null}
          </Animated.View>
        ) : null}

        {children}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  verticalPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  horizontalPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  horizontalDivider: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    height: 1.5,
    borderRadius: 1,
    zIndex: 1,
  },
  verticalDivider: {
    position: 'absolute',
    top: '15%',
    bottom: '15%',
    width: 1.5,
    borderRadius: 1,
    zIndex: 1,
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 2,
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
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  copy: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 320,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
})
