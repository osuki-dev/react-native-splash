import { useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import type { ImageSourcePropType } from 'react-native'
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
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

export interface PrismChromaticColors {
  /** Canvas background colour. Default `#07080E`. */
  background?: string
  /** Primary core emblem colour. Default `#FFFFFF`. */
  primary?: string
  /** Red/magenta chromatic aberration channel colour. Default `#FF1F6D`. */
  chromaticRed?: string
  /** Cyan/blue chromatic aberration channel colour. Default `#00F0FF`. */
  chromaticCyan?: string
  /** Shockwave and lens flare glow colour. Default `#00F0FF`. */
  glow?: string
  /** App title text colour. Default `#FFFFFF`. */
  text?: string
  /** Subtitle / descriptor text colour. Default `#8E9AA8`. */
  subtitle?: string
  /** Badge border and text colour. Default `#00F0FF`. */
  badge?: string
}

export interface PrismChromaticIntroProps extends IntroProps {
  /**
   * Custom logo element (ReactNode) or image source (`ImageSourcePropType`).
   * If omitted, falls back to the native splash logo or a built-in geometric aperture prism emblem.
   */
  logo?: ReactNode | ImageSourcePropType
  /** Colour palette configuration. */
  colors?: PrismChromaticColors
  /** Brand or app title. Default `"PRISM ENGINE"`. */
  title?: string
  /** Subtitle or descriptor below title. Default `"OPTICAL MOTION PIPELINE"`. */
  subtitle?: string
  /** Eyebrow badge text above the mark. Default `"GPU ACCELERATED"`. */
  badge?: string
  /** Maximum chromatic shift distance in points. Default `14`. */
  chromaticOffset?: number
  /** Number of orbiting ambient dust sparkles. Default `8`. */
  particleCount?: number
  /** Duration of the exit warp in ms. Default `520`. */
  exitDuration?: number
}

// Precomputed deterministic particle coordinates for floating sparkles
const SPARK_PARTICLES = [
  { x: -75, y: -65, size: 3, delay: 0 },
  { x: 80, y: -50, size: 4, delay: 200 },
  { x: -90, y: 35, size: 2.5, delay: 400 },
  { x: 70, y: 70, size: 3.5, delay: 150 },
  { x: -40, y: -90, size: 2, delay: 500 },
  { x: 50, y: -85, size: 3, delay: 350 },
  { x: -80, y: -10, size: 2.5, delay: 100 },
  { x: 85, y: 20, size: 3, delay: 250 },
]

/**
 * High-octane chromatic aberration & optical prism intro:
 * The brand emblem splits into vibrant RGB chromatic aberration channels (red/magenta and cyan),
 * jitters with an optical glitch, snaps into convergence, and detonates an energy shockwave ring
 * with an anamorphic lens flare sheen sweep.
 */
export function PrismChromaticIntro({
  phase,
  finish,
  colorScheme: _colorScheme,
  logo,
  colors: customColors,
  title = 'PRISM ENGINE',
  subtitle = 'OPTICAL MOTION PIPELINE',
  badge = 'GPU ACCELERATED',
  chromaticOffset = 14,
  particleCount = 8,
  exitDuration = 520,
}: PrismChromaticIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  // Default color palette
  const colors: Required<PrismChromaticColors> = {
    background: customColors?.background ?? '#07080E',
    primary: customColors?.primary ?? '#FFFFFF',
    chromaticRed: customColors?.chromaticRed ?? '#FF1F6D',
    chromaticCyan: customColors?.chromaticCyan ?? '#00F0FF',
    glow: customColors?.glow ?? '#00F0FF',
    text: customColors?.text ?? '#FFFFFF',
    subtitle: customColors?.subtitle ?? '#8E9AA8',
    badge: customColors?.badge ?? '#00F0FF',
  }

  // Animation values
  const enterScale = useSharedValue(0.7)
  const enterOpacity = useSharedValue(0)
  const chromaticShift = useSharedValue(1)
  const shockwave = useSharedValue(0)
  const sheenSweep = useSharedValue(-1.2)
  const particleFloat = useSharedValue(0)
  const copyEnter = useSharedValue(0)
  const exit = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      // 1. Logo pop-in
      enterScale.value = withDelay(60, withSpring(1, { damping: 14, stiffness: 150 }))
      enterOpacity.value = withTiming(1, { duration: 250 })

      // 2. Chromatic aberration jitter and convergence snap
      chromaticShift.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(1.3, { duration: 60 }),
        withTiming(0.4, { duration: 70 }),
        withTiming(0.9, { duration: 60 }),
        withSpring(0, { damping: 12, stiffness: 180 }),
      )

      // 3. Shockwave detonation timed right at convergence snap (~350ms)
      shockwave.value = withDelay(320, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }))

      // 4. Anamorphic lens flare sheen sweep across mark
      sheenSweep.value = withDelay(
        420,
        withTiming(1.2, { duration: 650, easing: Easing.inOut(Easing.cubic) }),
      )

      // 5. Ambient floating sparkle particles
      particleFloat.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      )

      // 6. Typography entrance
      copyEnter.value = withDelay(280, withSpring(1, { damping: 16, stiffness: 120 }))
      return
    }

    if (phase !== 'exiting') return

    // Exit animation: Warp speed fly-through with optical zoom
    exit.value = withTiming(1, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exitDuration])

  // Container style
  const containerStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 1 - exit.value,
    }
  })

  // Core mark transform
  const coreMarkStyle = useAnimatedStyle(() => {
    'worklet'
    const scale = interpolate(exit.value, [0, 1], [enterScale.value, 4.8], Extrapolation.CLAMP)
    const opacity = enterOpacity.value * interpolate(exit.value, [0, 0.7], [1, 0], Extrapolation.CLAMP)
    return {
      transform: [{ scale }],
      opacity,
    }
  })

  // Red/Magenta chromatic channel (offset top-left)
  const redChromaticStyle = useAnimatedStyle(() => {
    'worklet'
    const shift = chromaticShift.value * chromaticOffset
    const exitWarp = exit.value * chromaticOffset * 2.5
    const dx = -(shift + exitWarp)
    const dy = -(shift * 0.6 + exitWarp * 0.4)
    const opacity = interpolate(chromaticShift.value, [0, 0.2, 1], [0, 0.65, 0.85]) + exit.value * 0.6

    return {
      transform: [{ translateX: dx }, { translateY: dy }],
      opacity: opacity * enterOpacity.value,
    }
  })

  // Cyan/Electric Blue chromatic channel (offset bottom-right)
  const cyanChromaticStyle = useAnimatedStyle(() => {
    'worklet'
    const shift = chromaticShift.value * chromaticOffset
    const exitWarp = exit.value * chromaticOffset * 2.5
    const dx = shift + exitWarp
    const dy = shift * 0.6 + exitWarp * 0.4
    const opacity = interpolate(chromaticShift.value, [0, 0.2, 1], [0, 0.65, 0.85]) + exit.value * 0.6

    return {
      transform: [{ translateX: dx }, { translateY: dy }],
      opacity: opacity * enterOpacity.value,
    }
  })

  // Explosive shockwave ring style
  const shockwaveStyle = useAnimatedStyle(() => {
    'worklet'
    const scale = interpolate(shockwave.value, [0, 1], [0.15, 3.2], Extrapolation.CLAMP)
    const opacity = interpolate(shockwave.value, [0, 0.2, 0.8, 1], [0, 0.9, 0.3, 0], Extrapolation.CLAMP)
    return {
      transform: [{ scale }],
      opacity: opacity * (1 - exit.value),
    }
  })

  // Anamorphic light sheen sweep across logo
  const sheenStyle = useAnimatedStyle(() => {
    'worklet'
    const translateX = interpolate(sheenSweep.value, [-1.2, 1.2], [-140, 140])
    const opacity = interpolate(sheenSweep.value, [-1, -0.6, 0.6, 1], [0, 0.85, 0.85, 0], Extrapolation.CLAMP)
    return {
      transform: [{ translateX }, { rotate: '25deg' }],
      opacity,
    }
  })

  // Typography entrance style
  const copyStyle = useAnimatedStyle(() => {
    'worklet'
    const translateY = (1 - copyEnter.value) * 26 + exit.value * 35
    const opacity = copyEnter.value * (1 - exit.value * 2)
    return {
      transform: [{ translateY }],
      opacity,
    }
  })

  // Determine logo size
  const logoBaseSize = typeof mirror.logo.style.width === 'number' && mirror.logo.style.width > 0
    ? mirror.logo.style.width
    : 104

  // Render the logo content inside chromatic layer
  const renderLogoLayer = (tint?: string) => {
    if (logo) {
      if (typeof logo === 'object' && 'uri' in (logo as Record<string, unknown>)) {
        return (
          <Image
            source={logo as ImageSourcePropType}
            style={[styles.logoImage, { width: logoBaseSize, height: logoBaseSize }, tint ? { tintColor: tint } : null]}
            resizeMode="contain"
          />
        )
      }
      if (typeof logo === 'number') {
        return (
          <Image
            source={logo}
            style={[styles.logoImage, { width: logoBaseSize, height: logoBaseSize }, tint ? { tintColor: tint } : null]}
            resizeMode="contain"
          />
        )
      }
      return <View style={{ opacity: tint ? 0.75 : 1 }}>{logo as ReactNode}</View>
    }

    if (mirror.hasLogo) {
      return (
        <Image
          {...mirror.logo}
          style={[mirror.logo.style, styles.logoImage, tint ? { tintColor: tint } : null]}
          resizeMode="contain"
        />
      )
    }

    // Default: High-end geometric aperture prism emblem
    return (
      <View style={[styles.prismGlyph, { width: logoBaseSize, height: logoBaseSize }]}>
        <View
          style={[
            styles.prismDiamond,
            {
              width: logoBaseSize * 0.7,
              height: logoBaseSize * 0.7,
              borderColor: tint ?? colors.primary,
            },
          ]}
        />
        <View
          style={[
            styles.prismInnerHex,
            {
              width: logoBaseSize * 0.38,
              height: logoBaseSize * 0.38,
              backgroundColor: tint ? `${tint}66` : colors.glow,
            },
          ]}
        />
      </View>
    )
  }

  const shockwaveBaseSize = logoBaseSize * 1.5

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.background, width, height },
        containerStyle,
      ]}
    >
      {/* Background Subtle Tech Grid Circles */}
      <View style={styles.gridCanvas} pointerEvents="none">
        <View
          style={[
            styles.gridCircle,
            {
              width: width * 0.9,
              height: width * 0.9,
              borderRadius: (width * 0.9) / 2,
              borderColor: `${colors.glow}15`,
            },
          ]}
        />
        <View
          style={[
            styles.gridCircle,
            {
              width: width * 1.35,
              height: width * 1.35,
              borderRadius: (width * 1.35) / 2,
              borderColor: `${colors.glow}0A`,
            },
          ]}
        />
      </View>

      {/* Floating Sparkle Particles */}
      <View style={styles.centerAnchor} pointerEvents="none">
        {SPARK_PARTICLES.slice(0, particleCount).map((p, idx) => (
          <SparkleDot
            key={idx}
            particle={p}
            progress={particleFloat}
            color={idx % 2 === 0 ? colors.chromaticCyan : colors.chromaticRed}
          />
        ))}
      </View>

      {/* Shockwave Ring */}
      <View style={styles.centerAnchor} pointerEvents="none">
        <Animated.View
          style={[
            styles.shockwaveRing,
            {
              width: shockwaveBaseSize,
              height: shockwaveBaseSize,
              borderRadius: shockwaveBaseSize / 2,
              borderColor: colors.glow,
            },
            shockwaveStyle,
          ]}
        />
      </View>

      {/* Center Chromatic Logo Stack */}
      <View style={styles.centerAnchor}>
        <Animated.View style={[styles.markWrapper, coreMarkStyle]}>
          {/* Cyan Chromatic Layer (displaced bottom-right) */}
          <Animated.View style={[styles.chromaticLayer, cyanChromaticStyle]} pointerEvents="none">
            {renderLogoLayer(colors.chromaticCyan)}
          </Animated.View>

          {/* Red Chromatic Layer (displaced top-left) */}
          <Animated.View style={[styles.chromaticLayer, redChromaticStyle]} pointerEvents="none">
            {renderLogoLayer(colors.chromaticRed)}
          </Animated.View>

          {/* Core Master Layer */}
          <View style={styles.coreLayer}>
            {renderLogoLayer()}
          </View>

          {/* Anamorphic Sheen Blade */}
          <Animated.View
            style={[
              styles.sheenBlade,
              {
                width: logoBaseSize * 1.6,
                height: 18,
                backgroundColor: `${colors.glow}AA`,
              },
              sheenStyle,
            ]}
            pointerEvents="none"
          />
        </Animated.View>
      </View>

      {/* Tech Eyebrow, Title and Subtitle */}
      <Animated.View
        style={[
          styles.copyContainer,
          { top: height * 0.58, width },
          copyStyle,
        ]}
      >
        {badge ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: `${colors.badge}14`,
                borderColor: `${colors.badge}55`,
              },
            ]}
          >
            <View style={[styles.badgeDot, { backgroundColor: colors.badge }]} />
            <Text style={[styles.badgeText, { color: colors.badge }]}>{badge}</Text>
          </View>
        ) : null}

        {title ? (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        ) : null}

        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.subtitle }]}>{subtitle}</Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  )
}

interface SparkleProps {
  particle: (typeof SPARK_PARTICLES)[number]
  progress: SharedValue<number>
  color: string
}

function SparkleDot({ particle, progress, color }: SparkleProps) {
  const style = useAnimatedStyle(() => {
    'worklet'
    const translateY = interpolate(progress.value, [0, 1], [-8, 8])
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0.35, 0.95, 0.35])
    return {
      transform: [
        { translateX: particle.x },
        { translateY: particle.y + translateY },
      ],
      opacity,
    }
  })

  return (
    <Animated.View
      style={[
        styles.sparkleDot,
        {
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCanvas: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCircle: {
    position: 'absolute',
    borderWidth: 1,
  },
  centerAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  chromaticLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    alignSelf: 'center',
  },
  prismGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  prismDiamond: {
    position: 'absolute',
    borderWidth: 3,
    transform: [{ rotate: '45deg' }],
    borderRadius: 8,
  },
  prismInnerHex: {
    borderRadius: 999,
  },
  shockwaveRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  sheenBlade: {
    position: 'absolute',
    borderRadius: 999,
  },
  sparkleDot: {
    position: 'absolute',
  },
  copyContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.2,
    textAlign: 'center',
    textTransform: 'uppercase',
    maxWidth: 320,
  },
})
