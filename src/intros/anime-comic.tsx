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

export interface AnimeComicColors {
  /** Background canvas colour. Default `#0D0B18`. */
  background?: string
  /** Primary accent colour (Sakura pink). Default `#FF4081`. */
  accent?: string
  /** Secondary accent colour (Starlight violet). Default `#8C52FF`. */
  accentSecondary?: string
  /** Radial speedlines colour. Default `#FF4081`. */
  speedlines?: string
  /** Main title text colour. Default `#FFFFFF`. */
  text?: string
  /** Subtitle text colour. Default `#E2D9F3`. */
  subtitle?: string
  /** Japanese eyebrow badge text & border colour. Default `#FF4081`. */
  badge?: string
  /** Diagonal banner fill colour. Default `#8C52FF18`. */
  banner?: string
}

export interface AnimeComicIntroProps extends IntroProps {
  /**
   * Custom mascot image source, character illustration, or ReactNode.
   * If omitted, falls back to the native splash logo or a stylized anime star emblem.
   */
  logo?: ReactNode | ImageSourcePropType
  /** App or series title. Default `"NEO TOKYO"`. */
  title?: string
  /** Subtitle or series tagline. Default `"READY FOR ADVENTURE"`. */
  subtitle?: string
  /** Japanese Kanji / Katakana eyebrow badge. Default `"「 新次元の扉 」"`. */
  japaneseBadge?: string
  /** Colour palette configuration. */
  colors?: AnimeComicColors
  /** Number of floating Sakura petals. Default `8`. */
  petalCount?: number
  /** Duration of exit slash animation in ms. Default `480`. */
  exitDuration?: number
}

// Deterministic coordinates for floating Sakura petals
const PETAL_ITEMS = [
  { x: -110, y: -130, size: 9, rotate: '18deg', delay: 0 },
  { x: 120, y: -90, size: 12, rotate: '-25deg', delay: 200 },
  { x: -95, y: 70, size: 10, rotate: '40deg', delay: 450 },
  { x: 105, y: 120, size: 8, rotate: '-15deg', delay: 150 },
  { x: -50, y: -170, size: 11, rotate: '32deg', delay: 350 },
  { x: 75, y: -160, size: 9, rotate: '-45deg', delay: 500 },
  { x: -125, y: 10, size: 10, rotate: '12deg', delay: 100 },
  { x: 130, y: 30, size: 11, rotate: '-30deg', delay: 300 },
]

// 12 radial speedline rays
const SPEEDLINE_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

/**
 * High-energy Anime / Manga / ACG intro:
 * Features exploding radial speedlines, floating Sakura blossom petals,
 * a dynamic diagonal slash cut banner, and an anime katana dash exit.
 */
export function AnimeComicIntro({
  phase,
  finish,
  colorScheme: _colorScheme,
  logo,
  title = 'NEO TOKYO',
  subtitle = 'READY FOR ADVENTURE',
  japaneseBadge = '「 新次元の扉 」',
  colors: customColors,
  petalCount = 8,
  exitDuration = 480,
}: AnimeComicIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  // Default color palette
  const colors: Required<AnimeComicColors> = {
    background: customColors?.background ?? '#0D0B18',
    accent: customColors?.accent ?? '#FF4081',
    accentSecondary: customColors?.accentSecondary ?? '#8C52FF',
    speedlines: customColors?.speedlines ?? '#FF4081',
    text: customColors?.text ?? '#FFFFFF',
    subtitle: customColors?.subtitle ?? '#E2D9F3',
    badge: customColors?.badge ?? '#FF4081',
    banner: customColors?.banner ?? '#8C52FF22',
  }

  // Animation values
  const slashEnter = useSharedValue(-width * 1.5)
  const speedlineScale = useSharedValue(0.2)
  const speedlineOpacity = useSharedValue(0)
  const logoPop = useSharedValue(0.4)
  const logoOpacity = useSharedValue(0)
  const petalFlutter = useSharedValue(0)
  const copyEnter = useSharedValue(0)
  const exit = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      // 1. Diagonal slash banner enters with high-speed whip
      slashEnter.value = withTiming(0, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      })

      // 2. Exploding radial speedlines burst behind logo
      speedlineScale.value = withDelay(
        120,
        withSpring(1, { damping: 11, stiffness: 170 }),
      )
      speedlineOpacity.value = withDelay(
        100,
        withSequence(
          withTiming(0.75, { duration: 250 }),
          withTiming(0.4, { duration: 600 }),
        ),
      )

      // 3. Logo character pop-in with anime bounce
      logoPop.value = withDelay(
        140,
        withSpring(1, { damping: 11, stiffness: 160 }),
      )
      logoOpacity.value = withDelay(100, withTiming(1, { duration: 200 }))

      // 4. Floating Sakura petals flutter
      petalFlutter.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      )

      // 5. Typography pop
      copyEnter.value = withDelay(280, withSpring(1, { damping: 15, stiffness: 140 }))
      return
    }

    if (phase !== 'exiting') return

    // Exit transition: Katana slash dash across screen
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

  // Diagonal banner slash style
  const bannerStyle = useAnimatedStyle(() => {
    'worklet'
    const exitOffset = exit.value * width * 1.5
    return {
      transform: [
        { rotate: '-12deg' },
        { translateX: slashEnter.value - exitOffset },
      ],
      opacity: 1 - exit.value,
    }
  })

  // Radial speedlines transform
  const speedlinesContainerStyle = useAnimatedStyle(() => {
    'worklet'
    const exitScale = 1 + exit.value * 2.5
    return {
      transform: [{ scale: speedlineScale.value * exitScale }],
      opacity: speedlineOpacity.value * (1 - exit.value * 1.5),
    }
  })

  // Logo character pop-in style
  const logoMarkStyle = useAnimatedStyle(() => {
    'worklet'
    const scale = interpolate(exit.value, [0, 1], [logoPop.value, 3.8], Extrapolation.CLAMP)
    const opacity = logoOpacity.value * interpolate(exit.value, [0, 0.6], [1, 0], Extrapolation.CLAMP)
    return {
      transform: [{ scale }],
      opacity,
    }
  })

  // Typography entrance style
  const copyStyle = useAnimatedStyle(() => {
    'worklet'
    const translateY = (1 - copyEnter.value) * 26 + exit.value * 35
    const opacity = copyEnter.value * interpolate(exit.value, [0, 0.7], [1, 0], Extrapolation.CLAMP)
    return {
      transform: [{ translateY }],
      opacity,
    }
  })

  const logoBaseSize = typeof mirror.logo.style.width === 'number' && mirror.logo.style.width > 0
    ? mirror.logo.style.width
    : 110

  // Render the logo / mascot
  const renderLogo = () => {
    if (logo) {
      if (typeof logo === 'object' && 'uri' in (logo as Record<string, unknown>)) {
        return (
          <Image
            source={logo as ImageSourcePropType}
            style={[styles.logoImage, { width: logoBaseSize, height: logoBaseSize }]}
            resizeMode="contain"
          />
        )
      }
      if (typeof logo === 'number') {
        return (
          <Image
            source={logo}
            style={[styles.logoImage, { width: logoBaseSize, height: logoBaseSize }]}
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
          style={[mirror.logo.style, styles.logoImage, { width: logoBaseSize, height: logoBaseSize }]}
          resizeMode="contain"
        />
      )
    }

    // Default: Stylized anime radiant star crest
    return (
      <View style={[styles.animeStarEmblem, { width: logoBaseSize, height: logoBaseSize }]}>
        <View
          style={[
            styles.animeStarDiamond,
            {
              width: logoBaseSize * 0.72,
              height: logoBaseSize * 0.72,
              backgroundColor: colors.accent,
            },
          ]}
        />
        <View
          style={[
            styles.animeStarCore,
            {
              width: logoBaseSize * 0.38,
              height: logoBaseSize * 0.38,
              backgroundColor: colors.accentSecondary,
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
      {/* Dynamic Diagonal Slash Banner */}
      <Animated.View
        style={[
          styles.diagonalBanner,
          {
            width: width * 2,
            height: height * 0.38,
            backgroundColor: colors.banner,
            borderColor: `${colors.accent}44`,
          },
          bannerStyle,
        ]}
        pointerEvents="none"
      />

      {/* Radial Speedlines Canvas */}
      <View style={styles.centerAnchor} pointerEvents="none">
        <Animated.View style={[styles.speedlinesWrapper, speedlinesContainerStyle]}>
          {SPEEDLINE_ANGLES.map((angle) => (
            <View
              key={angle}
              style={[
                styles.speedlineRay,
                {
                  backgroundColor: colors.speedlines,
                  transform: [{ rotate: `${angle}deg` }, { translateY: -110 }],
                },
              ]}
            />
          ))}
        </Animated.View>
      </View>

      {/* Floating Sakura Petals */}
      <View style={styles.centerAnchor} pointerEvents="none">
        {PETAL_ITEMS.slice(0, petalCount).map((petal, index) => (
          <SakuraPetal
            key={index}
            petal={petal}
            flutter={petalFlutter}
            color={index % 2 === 0 ? colors.accent : colors.accentSecondary}
          />
        ))}
      </View>

      {/* Center Character / Logo Emblem */}
      <View style={styles.centerAnchor}>
        <Animated.View style={[styles.logoContainer, logoMarkStyle]}>
          {renderLogo()}
        </Animated.View>
      </View>

      {/* Japanese Eyebrow, Title and Subtitle */}
      <Animated.View
        style={[
          styles.copyContainer,
          { top: height * 0.58, width },
          copyStyle,
        ]}
      >
        {japaneseBadge ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: `${colors.badge}18`,
                borderColor: `${colors.badge}66`,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.badge }]}>
              {japaneseBadge}
            </Text>
          </View>
        ) : null}

        {title ? (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        ) : null}

        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.subtitle }]}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  )
}

interface PetalProps {
  petal: (typeof PETAL_ITEMS)[number]
  flutter: SharedValue<number>
  color: string
}

function SakuraPetal({ petal, flutter, color }: PetalProps) {
  const style = useAnimatedStyle(() => {
    'worklet'
    const dx = interpolate(flutter.value, [0, 1], [-12, 12])
    const dy = interpolate(flutter.value, [0, 1], [-16, 16])
    const opacity = interpolate(flutter.value, [0, 0.5, 1], [0.45, 0.95, 0.45])
    return {
      transform: [
        { translateX: petal.x + dx },
        { translateY: petal.y + dy },
        { rotate: petal.rotate },
      ],
      opacity,
    }
  })

  return (
    <Animated.View
      style={[
        styles.petalShape,
        {
          width: petal.size,
          height: petal.size * 1.4,
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
  diagonalBanner: {
    position: 'absolute',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
  },
  centerAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedlinesWrapper: {
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedlineRay: {
    position: 'absolute',
    width: 2.5,
    height: 70,
    borderRadius: 1.5,
    opacity: 0.65,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    alignSelf: 'center',
  },
  animeStarEmblem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  animeStarDiamond: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    borderRadius: 16,
  },
  animeStarCore: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    borderRadius: 8,
  },
  petalShape: {
    position: 'absolute',
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
  },
  copyContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
})
