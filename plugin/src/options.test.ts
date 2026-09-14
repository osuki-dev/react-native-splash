import { describe, expect, test } from 'bun:test'

import { normalizeColor, resolveSplashOptions } from './options'

describe('resolveSplashOptions', () => {
  test('applies defaults', () => {
    const resolved = resolveSplashOptions(undefined, 'ios')
    expect(resolved).toMatchObject({ backgroundColor: '#FFFFFF', imageWidth: 100, autoHide: true, hideTimeoutMs: 15000 })
    expect(resolved.image).toBeUndefined()
  })

  test('platform overrides win over root values and dark merges', () => {
    const resolved = resolveSplashOptions(
      {
        backgroundColor: '#f7f3ec',
        image: 'a.png',
        imageWidth: 128,
        dark: { backgroundColor: '#050b12', image: 'a-dark.png' },
        android: { imageWidth: 120, dark: { image: 'android-dark.png' }, postTheme: 'MyTheme' },
      },
      'android',
    )
    expect(resolved).toMatchObject({
      backgroundColor: '#F7F3EC',
      darkBackgroundColor: '#050B12',
      image: 'a.png',
      darkImage: 'android-dark.png',
      imageWidth: 120,
      postTheme: 'MyTheme',
    })
  })

  test('rejects an Android logo the OS would crop', () => {
    expect(() => resolveSplashOptions({ imageWidth: 200 }, 'android')).toThrow(/192/)
    expect(() => resolveSplashOptions({ imageWidth: 200 }, 'ios')).not.toThrow()
  })
})

describe('normalizeColor', () => {
  test('expands and upper-cases, drops alpha', () => {
    expect(normalizeColor('#abc')).toBe('#AABBCC')
    expect(normalizeColor('f7f3ec')).toBe('#F7F3EC')
    expect(normalizeColor('#F7F3EC80')).toBe('#F7F3EC')
    expect(() => normalizeColor('red')).toThrow()
  })
})
