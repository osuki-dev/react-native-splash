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
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

export interface CyberpunkGlitchColors {
  /** Canvas background colour. Default `#08080C`. */
  background?: string
  /** High-voltage neon yellow. Default `#FFE600`. */
  neonYellow?: string
  /** Cyber electric cyan. Default `#00F0FF`. */
  neonCyan?: string
  /** Laser magenta / hot pink. Default `#FF0055`. */
  neonPink?: string
  /** Holographic grid and crosshair colour. Default `#00F0FF16`. */
  gridColor?: string
  /** App title text colour. Default `#FFFFFF`. */
  text?: string
  /** Subtitle / descriptor text colour. Default `#FFE600`. */
  subtitle?: string
  /** CRT scanline beam colour. Default `#00F0FF2A`. */
  scanlineColor?: string
}

export interface CyberpunkGlitchIntroProps extends IntroProps {
  /**
   * Custom logo element (ReactNode) or image source (`ImageSourcePropType`).
   * If omitted, falls back to the native splash logo or a high-tech cyberpunk glyph.
   */
  logo?: ReactNode | ImageSourcePropType
  /** Brand or project title. Default `"CYBERPUNK"`. */
  title?: string
  /** Cyberpunk descriptor or district tag. Default `"NIGHT CITY // NETRUNNER"`. */
  subtitle?: string
  /** High-tech HUD badge. Default `"SYS://ONLINE"`. */
  badge?: string
  /** Top HUD sector coordinate string. Default `"SECTOR 04 // 0x7FA2"`. */
  hudCoordinates?: string
  /** Bottom telemetry status tags. */
  telemetryTags?: string[]
  /** Colour palette configuration. */
  colors?: CyberpunkGlitchColors
  /** Duration of CRT collapse exit in ms. Default `480`. */
  exitDuration?: number
}

const DEFAULT_TELEMETRY = ['CORE: ONLINE', 'SYNC: 99.8%', 'PORT: 8081']

/**
 * High-voltage Cyberpunk / Sci-Fi HUD intro:
 * Features holographic matrix grid overlays, animated CRT scanlines,
 * electric glitch jitter, high-tech telemetry readouts, and a CRT laser collapse exit.
 */
export function CyberpunkGlitchIntro({
  phase,
  finish,
  colorScheme: _colorScheme,
  logo,
  title = 'CYBERPUNK',
  subtitle = 'NIGHT CITY // NETRUNNER',
  badge = 'SYS://ONLINE',
  hudCoordinates = 'SECTOR 04 // 0x7FA2',
  telemetryTags = DEFAULT_TELEMETRY,
  colors: customColors,
  exitDuration = 480,
}: CyberpunkGlitchIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  // Default color palette
  const colors: Required<CyberpunkGlitchColors> = {
    background: customColors?.background ?? '#08080C',
    neonYellow: customColors?.neonYellow ?? '#FFE600',
    neonCyan: customColors?.neonCyan ?? '#00F0FF',
    neonPink: customColors?.neonPink ?? '#FF0055',
    gridColor: customColors?.gridColor ?? '#00F0FF16',
    text: customColors?.text ?? '#FFFFFF',
    subtitle: customColors?.subtitle ?? '#FFE600',
    scanlineColor: customColors?.scanlineColor ?? '#00F0FF2A',
  }

  // Animation values
  const scanlineY = useSharedValue(-height)
  const glitchJitter = useSharedValue(0)
  const hudAlpha = useSharedValue(0)
  const logoPop = useSharedValue(0.7)
  const logoOpacity = useSharedValue(0)
  const copyEnter = useSharedValue(0)
  const exit = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      // 1. CRT scanline continuous loop
      scanlineY.value = withRepeat(
        withTiming(height, { duration: 2600, easing: Easing.linear }),
        -1,
        false,
      )

      // 2. HUD coordinate & grid fade-in
      hudAlpha.value = withTiming(1, { duration: 400 })

      // 3. Logo entry pop
      logoPop.value = withDelay(80, withSpring(1, { damping: 13, stiffness: 150 }))
      logoOpacity.value = withTiming(1, { duration: 250 })

      // 4. Glitch jitter sequence
      glitchJitter.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 60 }),
          withTiming(-1, { duration: 40 }),
          withTiming(0.5, { duration: 50 }),
          withTiming(0, { duration: 80 }),
          withDelay(1200, withTiming(0, { duration: 10 })),
        ),
        -1,
        false,
      )

      // 5. Typography pop
      copyEnter.value = withDelay(240, withSpring(1, { damping: 15, stiffness: 130 }))
      return
    }

    if (phase !== 'exiting') return

    // Exit transition: CRT monitor power-down laser line collapse
    exit.value = withTiming(1, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exitDuration, height])

  // Container style (CRT vertical collapse on exit)
  const containerStyle = useAnimatedStyle(() => {
    'worklet'
    const scaleY = interpolate(exit.value, [0, 0.7, 1], [1, 0.008, 0], Extrapolation.CLAMP)
    const scaleX = interpolate(exit.value, [0, 0.7, 1], [1, 1, 0.05], Extrapolation.CLAMP)
    const opacity = interpolate(exit.value, [0, 0.85, 1], [1, 1, 0], Extrapolation.CLAMP)

    return {
      transform: [{ scaleY }, { scaleX }],
      opacity,
    }
  })

  // CRT scanline sweep style
  const scanlineStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ translateY: scanlineY.value }],
    }
  })

  // Glitch jitter transform on mark
  const glitchMarkStyle = useAnimatedStyle(() => {
    'worklet'
    const jitterX = glitchJitter.value * 6
    const jitterY = glitchJitter.value * 2
    const scale = interpolate(exit.value, [0, 1], [logoPop.value, 1.8], Extrapolation.CLAMP)
    const opacity = logoOpacity.value * interpolate(exit.value, [0, 0.6], [1, 0], Extrapolation.CLAMP)

    return {
      transform: [{ translateX: jitterX }, { translateY: jitterY }, { scale }],
      opacity,
    }
  })

  // Neon pink glitch shadow
  const pinkGlitchStyle = useAnimatedStyle(() => {
    'worklet'
    const dx = glitchJitter.value * 8
    const dy = -glitchJitter.value * 3
    const opacity = glitchJitter.value !== 0 ? 0.75 : 0
    return {
      transform: [{ translateX: dx }, { translateY: dy }],
      opacity,
    }
  })

  // Neon cyan glitch shadow
  const cyanGlitchStyle = useAnimatedStyle(() => {
    'worklet'
    const dx = -glitchJitter.value * 8
    const dy = glitchJitter.value * 3
    const opacity = glitchJitter.value !== 0 ? 0.75 : 0
    return {
      transform: [{ translateX: dx }, { translateY: dy }],
      opacity,
    }
  })

  // HUD elements fade
  const hudStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: hudAlpha.value * (1 - exit.value),
    }
  })

  // Typography entrance style
  const copyStyle = useAnimatedStyle(() => {
    'worklet'
    const translateY = (1 - copyEnter.value) * 22 + exit.value * 30
    const opacity = copyEnter.value * interpolate(exit.value, [0, 0.7], [1, 0], Extrapolation.CLAMP)
    return {
      transform: [{ translateY }],
      opacity,
    }
  })

  const logoBaseSize = typeof mirror.logo.style.width === 'number' && mirror.logo.style.width > 0
    ? mirror.logo.style.width
    : 110

  // Render the logo
  const renderLogo = (tint?: string) => {
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
      return <View style={{ opacity: tint ? 0.7 : 1 }}>{logo as ReactNode}</View>
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

    // Default: Cyberpunk Samurai / Oni geometric glyph
    return (
      <View style={[styles.cyberGlyph, { width: logoBaseSize, height: logoBaseSize }]}>
        <View
          style={[
            styles.cyberFrame,
            {
              width: logoBaseSize * 0.8,
              height: logoBaseSize * 0.8,
              borderColor: tint ?? colors.neonYellow,
            },
          ]}
        />
        <View
          style={[
            styles.cyberCore,
            {
              width: logoBaseSize * 0.42,
              height: logoBaseSize * 0.42,
              backgroundColor: tint ? `${tint}88` : colors.neonCyan,
            },
          ]}
        />
      </View>
    )
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.background, width, height },
        containerStyle,
      ]}
    >
      {/* Holographic HUD Grid & Lines */}
      <Animated.View style={[styles.gridCanvas, hudStyle]} pointerEvents="none">
        <View style={[styles.gridLineHorizontal, { borderColor: colors.gridColor, top: height * 0.2 }]} />
        <View style={[styles.gridLineHorizontal, { borderColor: colors.gridColor, top: height * 0.8 }]} />
        <View style={[styles.gridLineVertical, { borderColor: colors.gridColor, left: width * 0.12 }]} />
        <View style={[styles.gridLineVertical, { borderColor: colors.gridColor, right: width * 0.12 }]} />

        {/* Top HUD Coordinates */}
        <View style={[styles.hudHeader, { top: height * 0.14 }]}>
          <Text style={[styles.hudText, { color: colors.neonCyan }]}>[ {hudCoordinates} ]</Text>
        </View>
      </Animated.View>

      {/* CRT Scanline Beam */}
      <Animated.View
        style={[
          styles.scanlineBeam,
          {
            width,
            height: 120,
            backgroundColor: colors.scanlineColor,
          },
          scanlineStyle,
        ]}
        pointerEvents="none"
      />

      {/* Center Glitch Logo Stack */}
      <View style={styles.centerAnchor}>
        <Animated.View style={[styles.markWrapper, glitchMarkStyle]}>
          {/* Cyan Glitch Shadow */}
          <Animated.View style={[styles.glitchLayer, cyanGlitchStyle]} pointerEvents="none">
            {renderLogo(colors.neonCyan)}
          </Animated.View>

          {/* Pink Glitch Shadow */}
          <Animated.View style={[styles.glitchLayer, pinkGlitchStyle]} pointerEvents="none">
            {renderLogo(colors.neonPink)}
          </Animated.View>

          {/* Core Master Logo */}
          <View>{renderLogo()}</View>
        </Animated.View>
      </View>

      {/* High-Tech Eyebrow, Title and Subtitle */}
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
                backgroundColor: `${colors.neonYellow}18`,
                borderColor: `${colors.neonYellow}66`,
              },
            ]}
          >
            <View style={[styles.badgeDot, { backgroundColor: colors.neonYellow }]} />
            <Text style={[styles.badgeText, { color: colors.neonYellow }]}>{badge}</Text>
          </View>
        ) : null}

        {title ? (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        ) : null}

        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.subtitle }]}>{subtitle}</Text>
        ) : null}

        {/* Telemetry Tags Row */}
        {telemetryTags.length > 0 ? (
          <View style={styles.telemetryRow}>
            {telemetryTags.map((tag, idx) => (
              <View
                key={idx}
                style={[
                  styles.telemetryPill,
                  {
                    borderColor: `${colors.neonCyan}44`,
                    backgroundColor: `${colors.neonCyan}0E`,
                  },
                ]}
              >
                <Text style={[styles.telemetryText, { color: colors.neonCyan }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
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
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
  },
  hudHeader: {
    position: 'absolute',
    alignSelf: 'center',
  },
  hudText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scanlineBeam: {
    position: 'absolute',
    opacity: 0.35,
  },
  centerAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glitchLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    alignSelf: 'center',
  },
  cyberGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cyberFrame: {
    borderWidth: 2.5,
    borderRadius: 8,
    transform: [{ rotate: '45deg' }],
  },
  cyberCore: {
    position: 'absolute',
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
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
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  telemetryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
  },
  telemetryText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})
