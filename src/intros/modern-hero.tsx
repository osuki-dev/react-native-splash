import { useEffect } from 'react'
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
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

export interface ModernHeroIntroProps extends IntroProps {
  /** Headline title below the logo. Default "Designed to Perform". */
  title?: string
  /** Subtitle or value statement. Default "Fast, resilient, and beautifully responsive." */
  subtitle?: string
  /** Pill tags displayed in a staggered row. */
  tags?: string[]
  /** Accent colour for tags and progress bar. Default `#0F7C7C`. */
  accentColor?: string
  /** Custom title text colour. */
  textColor?: string
  /** Custom subtitle colour. */
  subtitleColor?: string
  /** Custom tag pill background colour. */
  tagBackgroundColor?: string
  /** Whether to show a progress bar at the bottom. Default `true`. */
  showProgress?: boolean
  /** Duration of the exit slide in ms. Default 540. */
  exitDuration?: number
}

const DEFAULT_TAGS = ['⚡️ Ultra-fast', '🔒 Private by Design', '📱 100% Native']

/**
 * Modern hero presentation: brand logo, rich typography, staggered badge pills,
 * and a bottom progress capsule. On exit, elements split directionally (text slides left,
 * logo glides right) for a dynamic screen handoff.
 */
export function ModernHeroIntro({
  phase,
  finish,
  colorScheme,
  title = 'Designed to Perform',
  subtitle = 'Fast, resilient, and beautifully responsive.',
  tags = DEFAULT_TAGS,
  accentColor = '#0F7C7C',
  textColor,
  subtitleColor,
  tagBackgroundColor,
  showProgress = true,
  exitDuration = 540,
}: ModernHeroIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  const enter = useSharedValue(0)
  const tagsProgress = useSharedValue(0)
  const progressLine = useSharedValue(0)
  const exit = useSharedValue(0)

  const tagList = tags.length > 0 ? tags : DEFAULT_TAGS

  useEffect(() => {
    if (phase === 'visible') {
      enter.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 120 }))
      tagsProgress.value = withDelay(
        250,
        withTiming(tagList.length, {
          duration: 180 * tagList.length + 200,
          easing: Easing.out(Easing.cubic),
        }),
      )
      if (showProgress) {
        progressLine.value = withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      }
      return
    }
    if (phase !== 'exiting') return
    exit.value = withTiming(1, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tagList.length, showProgress, exitDuration])

  const isDark = colorScheme === 'dark'
  const ink = textColor ?? (isDark ? '#E6EAF0' : '#1A2027')
  const muted = subtitleColor ?? (isDark ? '#98A3B0' : '#5B6672')
  const tagBg = tagBackgroundColor ?? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')

  // Background container
  const container = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 1 - exit.value,
    }
  })

  // Logo translates up slightly, then on exit glides to the right
  const logo = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        { translateY: -enter.value * 60 },
        { translateX: exit.value * (width * 0.45) },
        { scale: 1 - enter.value * 0.15 },
      ],
      opacity: interpolate(exit.value, [0, 0.7], [1, 0], Extrapolation.CLAMP),
    }
  })

  // Text & tags slide in, then on exit sweep to the left
  const textColumn = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: enter.value * (1 - exit.value * 1.5),
      transform: [
        { translateY: (1 - enter.value) * 32 },
        { translateX: -exit.value * (width * 0.45) },
      ],
    }
  })

  // Bottom progress bar
  const progressBar = useAnimatedStyle(() => {
    'worklet'
    return {
      width: `${progressLine.value * 100}%`,
      opacity: (1 - exit.value) * enter.value,
    }
  })

  return (
    <Animated.View style={[mirror.container.style, container]}>
      {/* Centered / Lifted Logo */}
      {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} /> : null}

      {/* Main Hero Copy & Tag Chips */}
      <Animated.View style={[styles.content, { top: height * 0.48, width }, textColumn]}>
        {title ? <Text style={[styles.title, { color: ink }]}>{title}</Text> : null}
        {subtitle ? <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text> : null}

        {/* Tag Pills */}
        <View style={styles.tagWrap}>
          {tagList.map((tag, index) => (
            <TagPill
              key={`${index}-${tag}`}
              text={tag}
              index={index}
              progress={tagsProgress}
              tagBg={tagBg}
              ink={ink}
              accentColor={accentColor}
            />
          ))}
        </View>

        {/* Progress Capsule */}
        {showProgress ? (
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressIndicator, { backgroundColor: accentColor }, progressBar]} />
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  )
}

function TagPill({
  text,
  index,
  progress,
  tagBg,
  ink,
  accentColor,
}: {
  text: string
  index: number
  progress: SharedValue<number>
  tagBg: string
  ink: string
  accentColor: string
}) {
  const animated = useAnimatedStyle(() => {
    'worklet'
    const t = Math.min(1, Math.max(0, progress.value - index))
    return {
      opacity: interpolate(t, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: (1 - t) * 18 },
        { scale: 0.85 + t * 0.15 },
      ],
    }
  })

  return (
    <Animated.View style={[styles.pill, { backgroundColor: tagBg, borderColor: `${accentColor}30` }, animated]}>
      <Text style={[styles.pillText, { color: ink }]}>{text}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 360,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    overflow: 'hidden',
    marginTop: 18,
  },
  progressIndicator: {
    height: '100%',
    borderRadius: 2,
  },
})
