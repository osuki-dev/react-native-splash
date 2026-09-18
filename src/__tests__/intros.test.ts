import { describe, expect, mock, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

mock.module('react-native', () => ({
  StyleSheet: { create: (styles: any) => styles },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Image: 'Image',
  useWindowDimensions: () => ({ width: 375, height: 812 }),
  Platform: { OS: 'ios' },
  useColorScheme: () => 'light',
}))

mock.module('react-native-reanimated', () => ({
  default: {
    View: 'Animated.View',
    Text: 'Animated.Text',
    Image: 'Animated.Image',
    ScrollView: 'Animated.ScrollView',
  },
  useSharedValue: (val: any) => ({ value: val }),
  useAnimatedStyle: (fn: any) => fn(),
  useAnimatedScrollHandler: (fn: any) => fn,
  withDelay: (_delay: number, anim: any) => anim,
  withTiming: (toValue: any, _config?: any, cb?: any) => {
    cb?.(true)
    return toValue
  },
  withSpring: (toValue: any, _config?: any, cb?: any) => {
    cb?.(true)
    return toValue
  },
  withRepeat: (anim: any) => anim,
  withSequence: (...anims: any[]) => anims[0],
  interpolate: (_val: number, _inR: any[], outR: any[]) => outR[0],
  Extrapolation: { CLAMP: 'clamp' },
  Easing: {
    in: (fn: any) => fn,
    out: (fn: any) => fn,
    inOut: (fn: any) => fn,
    cubic: (t: number) => t,
    sin: (t: number) => t,
    ease: (t: number) => t,
    back: () => (t: number) => t,
  },
}))

mock.module('react-native-worklets', () => ({
  scheduleOnRN: (fn: any) => fn(),
}))

const {
  LogoRevealIntro,
  CircleRevealIntro,
  TypographicIntro,
  OnboardingIntro,
  SplitCurtainIntro,
  FeatureShowcaseIntro,
  ZoomFadeIntro,
  ModernHeroIntro,
  PrismChromaticIntro,
  CreativeStudioIntro,
  AnimeComicIntro,
  CyberpunkGlitchIntro,
} = await import('../intros')

describe('Intros Export Suite', () => {
  test('all intro components are exported as valid functions', () => {
    const intros = [
      LogoRevealIntro,
      CircleRevealIntro,
      TypographicIntro,
      OnboardingIntro,
      SplitCurtainIntro,
      FeatureShowcaseIntro,
      ZoomFadeIntro,
      ModernHeroIntro,
      PrismChromaticIntro,
      CreativeStudioIntro,
      AnimeComicIntro,
      CyberpunkGlitchIntro,
    ]

    for (const intro of intros) {
      expect(typeof intro).toBe('function')
    }
  })

  test('every intro component has explicit worklet directives to prevent UI thread crashes', () => {
    const introsDir = join(__dirname, '..', 'intros')
    const files = readdirSync(introsDir).filter((f) => f.endsWith('.tsx'))

    expect(files.length).toBeGreaterThanOrEqual(8)

    for (const file of files) {
      const content = readFileSync(join(introsDir, file), 'utf-8')

      // If the file uses useAnimatedStyle, verify each style closure contains 'worklet'
      const animatedStyleMatches = content.match(/useAnimatedStyle\(\(\s*.*?\)\s*=>\s*\{/g)
      if (animatedStyleMatches) {
        // Count how many 'worklet' directives appear in the file
        const workletCount = (content.match(/'worklet'/g) || []).length
        // Each useAnimatedStyle should have at least one 'worklet', and callbacks should also have one
        expect(workletCount).toBeGreaterThanOrEqual(animatedStyleMatches.length)
      }

      // Check that scheduleOnRN is used whenever finish is called in animations
      if (content.includes('scheduleOnRN')) {
        expect(content).toContain("import { scheduleOnRN } from 'react-native-worklets'")
        // Verify scheduleOnRN(finish) is called inside worklet
        expect(content).toContain('scheduleOnRN(finish)')
      }
    }
  })
})
