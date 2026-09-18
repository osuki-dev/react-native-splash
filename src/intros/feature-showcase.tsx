import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
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

export interface FeatureItem {
  title: string
  description: string
  /** Accent colour for the badge or icon container. */
  accent?: string
  /** Short tag, emoji, or custom icon element. */
  icon?: ReactNode
}

export interface FeatureShowcaseIntroProps extends IntroProps {
  /** Main header title. Default "What's New". */
  title?: string
  /** Header subtitle or version. Default "Highlights in this release". */
  subtitle?: string
  /** List of highlight items. Defaults to 3 modern feature cards. */
  features?: FeatureItem[]
  /**
   * Whether the intro requires the user to tap the action button.
   * If `false`, the intro automatically exits when the app is ready. Default `false`.
   */
  interactive?: boolean
  /** Label for the action button when `interactive` is true. Default "Continue". */
  buttonText?: string
  /** Accent colour for highlights and active controls. Default `#2D4FCB`. */
  accentColor?: string
  /** Custom background colour for cards. */
  cardBackgroundColor?: string
  /** Custom text colour. */
  textColor?: string
  /** Custom muted/subtitle colour. */
  mutedColor?: string
  /** Exit animation duration in ms. Default 520. */
  exitDuration?: number
}

const DEFAULT_FEATURES: FeatureItem[] = [
  {
    title: 'Zero Frame Flash',
    description: 'The native launch screen hands off to React Native with exact sub-pixel fidelity.',
    accent: '#2D4FCB',
    icon: '⚡️',
  },
  {
    title: 'Fluid Animations',
    description: 'Hardware-accelerated UI worklets driven directly on the render thread.',
    accent: '#FF6B4A',
    icon: '✨',
  },
  {
    title: 'Ready When You Are',
    description: 'Bind completion to fonts, network warmup, or interactive user onboarding.',
    accent: '#0F7C7C',
    icon: '🚀',
  },
]

/**
 * Modern card-based feature showcase: the splash mark lifts to the header,
 * presenting a staggered cascade of rich highlight cards with icons and typography.
 * Supports both automatic progression and interactive tap-to-continue.
 */
export function FeatureShowcaseIntro({
  phase,
  finish,
  colorScheme,
  onDone,
  title = "What's New",
  subtitle = 'Highlights in this release',
  features = DEFAULT_FEATURES,
  interactive = false,
  buttonText = 'Continue',
  accentColor = '#2D4FCB',
  cardBackgroundColor,
  textColor,
  mutedColor,
  exitDuration = 520,
}: FeatureShowcaseIntroProps) {
  const mirror = useSplashMirror()
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const width = winWidth || 375
  const height = winHeight || 812

  const lift = useSharedValue(0)
  const cardsProgress = useSharedValue(0)
  const exit = useSharedValue(0)

  const items = features.length > 0 ? features : DEFAULT_FEATURES

  useEffect(() => {
    if (phase === 'visible') {
      lift.value = withDelay(80, withSpring(1, { damping: 15, stiffness: 120 }))
      cardsProgress.value = withDelay(
        220,
        withTiming(items.length, {
          duration: 180 * items.length + 300,
          easing: Easing.out(Easing.cubic),
        }),
      )
      return
    }
    if (phase !== 'exiting') return
    exit.value = withTiming(1, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, items.length, exitDuration])

  const isDark = colorScheme === 'dark'
  const ink = textColor ?? (isDark ? '#E6EAF0' : '#1A2027')
  const muted = mutedColor ?? (isDark ? '#98A3B0' : '#5B6672')
  const cardBg = cardBackgroundColor ?? (isDark ? 'rgba(255, 255, 255, 0.07)' : '#F5F7FA')
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'

  // Container exit style
  const container = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 1 - exit.value,
      transform: [{ translateY: exit.value * (height * 0.1) }],
    }
  })

  // Header mark lifts upward from center
  const logo = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        { translateY: -lift.value * (height * 0.3) },
        { scale: 1 - lift.value * 0.45 },
      ],
    }
  })

  // Header text fades and slides into place
  const header = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: lift.value,
      transform: [{ translateY: (1 - lift.value) * 30 }],
    }
  })

  // Footer action button or loading indicator
  const footerStyle = useAnimatedStyle(() => {
    'worklet'
    const show = Math.min(1, Math.max(0, cardsProgress.value - (items.length - 1)))
    return {
      opacity: show * (1 - exit.value),
      transform: [{ translateY: (1 - show) * 20 }],
    }
  })

  return (
    <Animated.View style={[mirror.container.style, container]}>
      {/* Header Logo */}
      {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} /> : null}

      {/* Main Content Area */}
      <View style={[styles.contentWrapper, { top: height * 0.23, width }]}>
        {/* Header Titles */}
        <Animated.View style={[styles.header, header]}>
          <Text style={[styles.title, { color: ink }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text> : null}
        </Animated.View>

        {/* Feature Cards */}
        <View style={styles.cardList}>
          {items.map((item, index) => (
            <CardRow
              key={`${index}-${item.title}`}
              item={item}
              index={index}
              progress={cardsProgress}
              exit={exit}
              cardBg={cardBg}
              cardBorder={cardBorder}
              ink={ink}
              muted={muted}
              defaultAccent={accentColor}
            />
          ))}
        </View>

        {/* Footer: Interactive Button or Loading Pulse */}
        <Animated.View style={[styles.footer, footerStyle]}>
          {interactive ? (
            <Pressable
              onPress={() => onDone?.()}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: accentColor },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </Pressable>
          ) : (
            <View style={styles.loadingBar}>
              <View style={[styles.loadingDot, { backgroundColor: accentColor }]} />
            </View>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  )
}

interface CardRowProps {
  item: FeatureItem
  index: number
  progress: SharedValue<number>
  exit: SharedValue<number>
  cardBg: string
  cardBorder: string
  ink: string
  muted: string
  defaultAccent: string
}

function CardRow({
  item,
  index,
  progress,
  exit,
  cardBg,
  cardBorder,
  ink,
  muted,
  defaultAccent,
}: CardRowProps) {
  const animated = useAnimatedStyle(() => {
    'worklet'
    const t = Math.min(1, Math.max(0, progress.value - index))
    return {
      opacity: interpolate(t, [0, 1], [0, 1], Extrapolation.CLAMP) * (1 - exit.value),
      transform: [
        { translateY: (1 - t) * 36 + exit.value * 30 },
        { scale: 0.94 + t * 0.06 },
      ],
    }
  })

  const accent = item.accent ?? defaultAccent

  return (
    <Animated.View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }, animated]}>
      <View style={[styles.iconBox, { backgroundColor: `${accent}20` }]}>
        {typeof item.icon === 'string' ? (
          <Text style={styles.iconText}>{item.icon}</Text>
        ) : (
          item.icon ?? <View style={[styles.defaultDot, { backgroundColor: accent }]} />
        )}
      </View>
      <View style={styles.cardCopy}>
        <Text style={[styles.cardTitle, { color: ink }]}>{item.title}</Text>
        <Text style={[styles.cardDesc, { color: muted }]}>{item.description}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  contentWrapper: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  cardList: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  defaultDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.25)',
    overflow: 'hidden',
  },
  loadingDot: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
})
