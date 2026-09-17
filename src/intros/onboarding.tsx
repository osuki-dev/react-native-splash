import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
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

export interface OnboardingPage {
  title: string
  body: string
  /** Accent colour for the page's art and its dot. */
  accent: string
  /** Custom art instead of the default shape. */
  art?: ReactNode
}

export interface OnboardingIntroProps extends IntroProps {
  pages?: OnboardingPage[]
  nextLabel?: string
  startLabel?: string
  /** Button background. Default near-black. */
  buttonColor?: string
  buttonTextColor?: string
}

const DEFAULT_PAGES: OnboardingPage[] = [
  { title: 'Hands off', body: 'The native launch screen stays up until this view is painted, then lets go in the same frame.', accent: '#FF6B4A' },
  { title: 'Your animation', body: 'Everything here is Reanimated in app code. The library only says when.', accent: '#2D4FCB' },
  { title: 'Then the app', body: 'Bind ready to fonts, settings, or this button. Exit when you say so.', accent: '#0F7C7C' },
]

/**
 * Interactive: the mirror shrinks into a header, swipeable pages with
 * parallax appear underneath, and "Get started" hands control back through
 * `onDone`.
 */
export function OnboardingIntro({
  phase,
  finish,
  colorScheme,
  onDone,
  pages = DEFAULT_PAGES,
  nextLabel = 'Next',
  startLabel = 'Get started',
  buttonColor = '#1A2027',
  buttonTextColor = '#FFFFFF',
}: OnboardingIntroProps) {
  const mirror = useSplashMirror()
  const { width, height } = useWindowDimensions()
  const scrollRef = useRef<Animated.ScrollView>(null)

  const reveal = useSharedValue(0)
  const scrollX = useSharedValue(0)
  const exit = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      reveal.value = withDelay(120, withSpring(1, { damping: 15, stiffness: 110 }))
      return
    }
    if (phase !== 'exiting') return
    exit.value = withTiming(1, { duration: 560, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const onScroll = useAnimatedScrollHandler((event) => {
    'worklet'
    scrollX.value = event.contentOffset.x
  })

  const container = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ translateY: exit.value * height * 0.35 }],
      opacity: 1 - exit.value,
    }
  })
  // From the centred 1:1 mirror to a small header mark.
  const logo = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ translateY: -reveal.value * height * 0.33 }, { scale: 1 - reveal.value * 0.55 }],
    }
  })
  const sheet = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: reveal.value,
      transform: [{ translateY: (1 - reveal.value) * 60 }],
    }
  })

  const ink = colorScheme === 'dark' ? '#E6EAF0' : '#1A2027'
  const muted = colorScheme === 'dark' ? '#98A3B0' : '#5B6672'

  const goNext = () => {
    const page = Math.round(scrollX.value / width)
    if (page >= pages.length - 1) {
      onDone()
      return
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true })
  }

  return (
    <Animated.View style={[mirror.container.style, container]}>
      {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} /> : null}

      <Animated.View style={[styles.pages, { top: height * 0.32 }, sheet]}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {pages.map((page, index) => (
            <Page key={`${index}-${page.title}`} index={index} width={width} scrollX={scrollX} ink={ink} muted={muted} page={page} />
          ))}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {pages.map((page, index) => (
              <Dot key={`${index}-${page.title}`} index={index} width={width} scrollX={scrollX} color={page.accent} />
            ))}
          </View>
          <Pressable onPress={goNext} style={({ pressed }) => [styles.button, { backgroundColor: buttonColor }, pressed && styles.buttonPressed]}>
            <ButtonLabel scrollX={scrollX} width={width} pageCount={pages.length} next={nextLabel} start={startLabel} color={buttonTextColor} />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

function Page({
  index,
  width,
  scrollX,
  page,
  ink,
  muted,
}: {
  index: number
  width: number
  scrollX: SharedValue<number>
  page: OnboardingPage
  ink: string
  muted: string
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width]
  const art = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        { translateX: interpolate(scrollX.value, range, [width * 0.35, 0, -width * 0.35], Extrapolation.CLAMP) },
        { rotateZ: `${interpolate(scrollX.value, range, [18, 0, -18], Extrapolation.CLAMP)}deg` },
      ],
      opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    }
  })
  const text = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ translateX: interpolate(scrollX.value, range, [width * 0.15, 0, -width * 0.15], Extrapolation.CLAMP) }],
      opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    }
  })
  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={art}>
        {page.art ?? (
          <View style={[styles.art, { backgroundColor: page.accent }]}>
            <View style={styles.artInner} />
          </View>
        )}
      </Animated.View>
      <Animated.View style={[styles.copy, text]}>
        <Text style={[styles.title, { color: ink }]}>{page.title}</Text>
        <Text style={[styles.body, { color: muted }]}>{page.body}</Text>
      </Animated.View>
    </View>
  )
}

function Dot({ index, width, scrollX, color }: { index: number; width: number; scrollX: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    'worklet'
    const range = [(index - 1) * width, index * width, (index + 1) * width]
    return {
      width: interpolate(scrollX.value, range, [8, 26, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, range, [0.35, 1, 0.35], Extrapolation.CLAMP),
    }
  })
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
}

function ButtonLabel({
  scrollX,
  width,
  pageCount,
  next,
  start,
  color,
}: {
  scrollX: SharedValue<number>
  width: number
  pageCount: number
  next: string
  start: string
  color: string
}) {
  const last = Math.max(1, pageCount - 1) * width
  const nextStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: interpolate(scrollX.value, [last - width, last], [1, 0], Extrapolation.CLAMP) }
  })
  const startStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: interpolate(scrollX.value, [last - width, last], [0, 1], Extrapolation.CLAMP) }
  })
  return (
    <View style={styles.buttonLabel}>
      <Animated.Text style={[styles.buttonText, { color }, nextStyle]}>{next}</Animated.Text>
      <Animated.Text style={[styles.buttonText, styles.buttonTextOverlay, { color }, startStyle]}>{start}</Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pages: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  page: { alignItems: 'center', paddingHorizontal: 32, gap: 28 },
  art: { width: 132, height: 132, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  artInner: { width: 72, height: 72, borderRadius: 36, borderWidth: 10, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.85)' },
  copy: { alignItems: 'center', gap: 10, maxWidth: 360 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  footer: { alignItems: 'center', gap: 22, paddingBottom: 48, paddingTop: 8 },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  button: { borderRadius: 999, paddingHorizontal: 32, paddingVertical: 14, minWidth: 180 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { alignItems: 'center', justifyContent: 'center', height: 22 },
  buttonText: { fontWeight: '700', fontSize: 16 },
  buttonTextOverlay: { position: 'absolute' },
})
