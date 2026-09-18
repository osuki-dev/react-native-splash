import { useEffect, useState } from 'react'
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

export interface CreativeStudioColors {
  /** Background canvas colour. Default `#0B0D17`. */
  background?: string
  /** Center emblem card background colour. Default `#141727`. */
  cardBackground?: string
  /** Primary accent and frame border colour. Default `#6366F1`. */
  accent?: string
  /** Dual ambient aura colours that create the breathing background liquid mesh. Default `['#4F46E5', '#D946EF']`. */
  auraColors?: [string, string]
  /** Title text colour. Default `#FFFFFF`. */
  text?: string
  /** Subtitle / version text colour. Default `#64748B`. */
  subtitle?: string
  /** Status ticker text colour. Default `#94A3B8`. */
  statusText?: string
  /** Hairline progress bar fill colour. Default `#6366F1`. */
  progressFill?: string
}

export interface CreativeStudioIntroProps extends IntroProps {
  /**
   * Custom logo element (ReactNode) or image source (`ImageSourcePropType`).
   * If omitted, uses the native splash logo or a stylized Adobe-inspired studio emblem.
   */
  logo?: ReactNode | ImageSourcePropType
  /** App or studio title. Default `"CREATIVE STUDIO"`. */
  title?: string
  /** Subtitle or version tag. Default `"v2026.4 • MOTION STUDIO"`. */
  subtitle?: string
  /** Dynamic initialization status steps to cycle through while loading. */
  statusSteps?: string[]
  /** Colour palette configuration. */
  colors?: CreativeStudioColors
  /** Whether to show the bottom hairline progress bar. Default `true`. */
  showProgressBar?: boolean
  /** Duration of the exit iris dissolve in ms. Default `480`. */
  exitDuration?: number
}

const DEFAULT_STATUS_STEPS = [
  'Initializing GPU Pipeline...',
  'Loading Creative Presets...',
  'Calibrating Color Profiles...',
  'Workspace Ready',
]

/**
 * High-end cinematic studio splash:
 * Features a breathing radial liquid aura, precision kinetic framing brackets (`┌ ┐ └ ┘`)
 * that snap onto the emblem card, a live asset initialization ticker, and an optical iris dissolve exit.
 */
export function CreativeStudioIntro({
  phase,
  finish,
  colorScheme: _colorScheme,
  logo,
  title = 'CREATIVE STUDIO',
  subtitle = 'v2026.4 • MOTION STUDIO',
  statusSteps = DEFAULT_STATUS_STEPS,
  colors: customColors,
  showProgressBar = true,
  exitDuration = 480,
}: CreativeStudioIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  // Default color palette
  const colors: Required<CreativeStudioColors> = {
    background: customColors?.background ?? '#0B0D17',
    cardBackground: customColors?.cardBackground ?? '#141727',
    accent: customColors?.accent ?? '#6366F1',
    auraColors: customColors?.auraColors ?? ['#4F46E5', '#D946EF'],
    text: customColors?.text ?? '#FFFFFF',
    subtitle: customColors?.subtitle ?? '#64748B',
    statusText: customColors?.statusText ?? '#94A3B8',
    progressFill: customColors?.progressFill ?? '#6366F1',
  }

  // Animation shared values
  const auraRotate = useSharedValue(0)
  const auraPulse = useSharedValue(1)
  const frameSnap = useSharedValue(0)
  const cardScale = useSharedValue(0.8)
  const cardOpacity = useSharedValue(0)
  const cardTranslateY = useSharedValue(20)
  const progressBar = useSharedValue(0)
  const copyEnter = useSharedValue(0)
  const exit = useSharedValue(0)

  // Cycling status ticker index
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    if (phase !== 'visible') return

    const stepCount = statusSteps.length
    if (stepCount <= 1) return

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1 < stepCount ? prev + 1 : prev))
    }, 450)

    return () => clearInterval(interval)
  }, [phase, statusSteps])

  useEffect(() => {
    if (phase === 'visible') {
      // 1. Ambient liquid aura rotation and breathing pulse
      auraRotate.value = withRepeat(
        withTiming(360, { duration: 16000, easing: Easing.linear }),
        -1,
        false,
      )
      auraPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.92, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      )

      // 2. Kinetic framing brackets snap into place
      frameSnap.value = withDelay(80, withSpring(1, { damping: 14, stiffness: 150 }))

      // 3. Central card scale, opacity, and translateY settle
      cardScale.value = withDelay(120, withSpring(1, { damping: 15, stiffness: 140 }))
      cardOpacity.value = withTiming(1, { duration: 300 })
      cardTranslateY.value = withDelay(100, withSpring(0, { damping: 16, stiffness: 120 }))

      // 4. Progress bar smooth glide
      if (showProgressBar) {
        progressBar.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) })
      }

      // 5. Typography entrance
      copyEnter.value = withDelay(240, withSpring(1, { damping: 16, stiffness: 120 }))
      return
    }

    if (phase !== 'exiting') return

    // Exit transition: Shutter iris burst and canvas dissolve
    exit.value = withTiming(1, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exitDuration, showProgressBar])

  // Container style
  const containerStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 1 - exit.value,
    }
  })

  // Ambient liquid aura mesh transform
  const auraStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        { rotate: `${auraRotate.value}deg` },
        { scale: auraPulse.value * (1 + exit.value * 0.5) },
      ],
      opacity: (1 - exit.value) * 0.42,
    }
  })

  // Central emblem card transform
  const cardStyle = useAnimatedStyle(() => {
    'worklet'
    const scale = interpolate(exit.value, [0, 1], [cardScale.value, 2.2], Extrapolation.CLAMP)
    const opacity = cardOpacity.value * interpolate(exit.value, [0, 0.7], [1, 0], Extrapolation.CLAMP)
    return {
      transform: [
        { translateY: cardTranslateY.value },
        { scale },
      ],
      opacity,
    }
  })

  // Top-left bracket style
  const bracketTL = useAnimatedStyle(() => {
    'worklet'
    const offset = (1 - frameSnap.value) * 28 + exit.value * 50
    const opacity = frameSnap.value * (1 - exit.value)
    return {
      transform: [{ translateX: -offset }, { translateY: -offset }],
      opacity,
    }
  })

  // Top-right bracket style
  const bracketTR = useAnimatedStyle(() => {
    'worklet'
    const offset = (1 - frameSnap.value) * 28 + exit.value * 50
    const opacity = frameSnap.value * (1 - exit.value)
    return {
      transform: [{ translateX: offset }, { translateY: -offset }],
      opacity,
    }
  })

  // Bottom-left bracket style
  const bracketBL = useAnimatedStyle(() => {
    'worklet'
    const offset = (1 - frameSnap.value) * 28 + exit.value * 50
    const opacity = frameSnap.value * (1 - exit.value)
    return {
      transform: [{ translateX: -offset }, { translateY: offset }],
      opacity,
    }
  })

  // Bottom-right bracket style
  const bracketBR = useAnimatedStyle(() => {
    'worklet'
    const offset = (1 - frameSnap.value) * 28 + exit.value * 50
    const opacity = frameSnap.value * (1 - exit.value)
    return {
      transform: [{ translateX: offset }, { translateY: offset }],
      opacity,
    }
  })

  // Hairline progress bar style
  const progressBarStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      width: `${progressBar.value * 100}%`,
    }
  })

  // Typography entrance style
  const copyStyle = useAnimatedStyle(() => {
    'worklet'
    const translateY = (1 - copyEnter.value) * 22 + exit.value * 30
    const opacity = copyEnter.value * (1 - exit.value * 2)
    return {
      transform: [{ translateY }],
      opacity,
    }
  })

  const cardBaseSize = 132
  const bracketThickness = 2.5
  const bracketLength = 16

  // Render the logo inside the card
  const renderLogo = () => {
    if (logo) {
      if (typeof logo === 'object' && 'uri' in (logo as Record<string, unknown>)) {
        return (
          <Image
            source={logo as ImageSourcePropType}
            style={[styles.logoImage, { width: cardBaseSize * 0.65, height: cardBaseSize * 0.65 }]}
            resizeMode="contain"
          />
        )
      }
      if (typeof logo === 'number') {
        return (
          <Image
            source={logo}
            style={[styles.logoImage, { width: cardBaseSize * 0.65, height: cardBaseSize * 0.65 }]}
            resizeMode="contain"
          />
        )
      }
      return <View>{logo as ReactNode}</View>
    }

    if (mirror.hasLogo) {
      return (
        <Image
          {...mirror.logo}
          style={[mirror.logo.style, styles.logoImage, { width: cardBaseSize * 0.65, height: cardBaseSize * 0.65 }]}
          resizeMode="contain"
        />
      )
    }

    // Default: Studio typographic monogram emblem
    return (
      <View style={styles.defaultMonogram}>
        <Text style={[styles.monogramText, { color: colors.accent }]}>CS</Text>
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
      {/* Background Liquid Aura Mesh */}
      <View style={styles.auraWrapper} pointerEvents="none">
        <Animated.View style={[styles.auraContainer, auraStyle]}>
          <View
            style={[
              styles.auraOrb,
              {
                width: width * 0.8,
                height: width * 0.8,
                borderRadius: (width * 0.8) / 2,
                backgroundColor: colors.auraColors[0],
                top: -width * 0.25,
                left: -width * 0.2,
              },
            ]}
          />
          <View
            style={[
              styles.auraOrb,
              {
                width: width * 0.85,
                height: width * 0.85,
                borderRadius: (width * 0.85) / 2,
                backgroundColor: colors.auraColors[1],
                bottom: -width * 0.25,
                right: -width * 0.2,
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Central Emblem with Precision Framing Brackets */}
      <View style={styles.centerAnchor}>
        {/* Corner Brackets */}
        <View
          style={[
            styles.bracketFrame,
            { width: cardBaseSize + 24, height: cardBaseSize + 24 },
          ]}
          pointerEvents="none"
        >
          {/* Top-Left Bracket */}
          <Animated.View
            style={[
              styles.bracketCorner,
              styles.bracketTopLeft,
              {
                borderColor: colors.accent,
                borderLeftWidth: bracketThickness,
                borderTopWidth: bracketThickness,
                width: bracketLength,
                height: bracketLength,
              },
              bracketTL,
            ]}
          />
          {/* Top-Right Bracket */}
          <Animated.View
            style={[
              styles.bracketCorner,
              styles.bracketTopRight,
              {
                borderColor: colors.accent,
                borderRightWidth: bracketThickness,
                borderTopWidth: bracketThickness,
                width: bracketLength,
                height: bracketLength,
              },
              bracketTR,
            ]}
          />
          {/* Bottom-Left Bracket */}
          <Animated.View
            style={[
              styles.bracketCorner,
              styles.bracketBottomLeft,
              {
                borderColor: colors.accent,
                borderLeftWidth: bracketThickness,
                borderBottomWidth: bracketThickness,
                width: bracketLength,
                height: bracketLength,
              },
              bracketBL,
            ]}
          />
          {/* Bottom-Right Bracket */}
          <Animated.View
            style={[
              styles.bracketCorner,
              styles.bracketBottomRight,
              {
                borderColor: colors.accent,
                borderRightWidth: bracketThickness,
                borderBottomWidth: bracketThickness,
                width: bracketLength,
                height: bracketLength,
              },
              bracketBR,
            ]}
          />
        </View>

        {/* Central Frosted Emblem Card */}
        <Animated.View
          style={[
            styles.emblemCard,
            {
              width: cardBaseSize,
              height: cardBaseSize,
              backgroundColor: colors.cardBackground,
              borderColor: `${colors.accent}44`,
            },
            cardStyle,
          ]}
        >
          {/* Subtle Inner Glow Border */}
          <View
            style={[
              styles.innerGlow,
              { borderColor: `${colors.accent}20` },
            ]}
            pointerEvents="none"
          />
          {renderLogo()}
        </Animated.View>
      </View>

      {/* Typography & Dynamic Initialization Ticker */}
      <Animated.View
        style={[
          styles.copyContainer,
          { top: height * 0.59, width },
          copyStyle,
        ]}
      >
        {title ? (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        ) : null}

        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.subtitle }]}>{subtitle}</Text>
        ) : null}

        {/* Status Loading Step */}
        {statusSteps.length > 0 ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.statusText, { color: colors.statusText }]}>
              {statusSteps[currentStepIndex]}
            </Text>
          </View>
        ) : null}

        {/* Hairline Precision Progress Bar */}
        {showProgressBar ? (
          <View style={[styles.progressBarTrack, { backgroundColor: `${colors.accent}22` }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                { backgroundColor: colors.progressFill },
                progressBarStyle,
              ]}
            />
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
  auraWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraContainer: {
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraOrb: {
    position: 'absolute',
    opacity: 0.75,
  },
  centerAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracketFrame: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracketCorner: {
    position: 'absolute',
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
  },
  emblemCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  innerGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    borderWidth: 1,
  },
  logoImage: {
    alignSelf: 'center',
  },
  defaultMonogram: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  copyContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  progressBarTrack: {
    width: 140,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1,
  },
})
