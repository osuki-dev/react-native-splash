import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import type { StyleProp, TextStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useSplashMirror } from '../use-splash-mirror'
import type { IntroProps } from './types'

export interface TypographicIntroProps extends IntroProps {
  /** Lines that land one after another. Default three words. */
  words?: string[]
  /** Text colour; defaults to near-black / near-white by colour scheme. */
  textColor?: string
  /** Extra style for each line (font family, size). */
  textStyle?: TextStyle
}

const DEFAULT_WORDS = ['Native.', 'Seamless.', 'Yours.']

/**
 * Editorial: the logo slides up to make room, a tagline lands word by word,
 * and the whole sheet lifts away like a curtain.
 */
export function TypographicIntro({ phase, finish, colorScheme, words = DEFAULT_WORDS, textColor, textStyle }: TypographicIntroProps) {
  const mirror = useSplashMirror()
  const { height } = useWindowDimensions()
  const lift = useSharedValue(0)
  const progress = useSharedValue(0)
  const curtain = useSharedValue(0)

  useEffect(() => {
    if (phase === 'visible') {
      lift.value = withDelay(150, withSpring(1, { damping: 14, stiffness: 120 }))
      // One value drives every word; each word reads its own slice of it.
      progress.value = withDelay(450, withTiming(words.length, { duration: 160 * words.length + 400, easing: Easing.out(Easing.cubic) }))
      return
    }
    if (phase !== 'exiting') return
    curtain.value = withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) scheduleOnRN(finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const sheet = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ translateY: -curtain.value * height }],
    }
  })
  const logo = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [{ translateY: -lift.value * 90 }, { scale: 1 - lift.value * 0.25 }],
    }
  })

  const ink = textColor ?? (colorScheme === 'dark' ? '#E6EAF0' : '#1A2027')
  return (
    <Animated.View style={[mirror.container.style, sheet]}>
      {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} /> : null}
      <Animated.View style={styles.tagline}>
        {words.map((word, index) => (
          <Word key={`${index}-${word}`} index={index} progress={progress} style={[styles.word, { color: ink }, textStyle]}>
            {word}
          </Word>
        ))}
      </Animated.View>
    </Animated.View>
  )
}

function Word({ index, progress, style, children }: { index: number; progress: SharedValue<number>; style: StyleProp<TextStyle>; children: string }) {
  const animated = useAnimatedStyle(() => {
    'worklet'
    const t = Math.min(1, Math.max(0, progress.value - index))
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 28 }, { rotateZ: `${(1 - t) * -4}deg` }],
    }
  })
  return <Animated.Text style={[style, animated]}>{children}</Animated.Text>
}

const styles = StyleSheet.create({
  tagline: { position: 'absolute', top: '56%', alignItems: 'center', gap: 2 },
  word: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
})
