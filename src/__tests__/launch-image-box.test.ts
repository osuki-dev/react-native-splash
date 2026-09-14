import { describe, expect, test } from 'bun:test'

import { launchImageBox } from '../launch-image'

const hero = { uri: 'file:///hero.png', backgroundColor: '#000', widthFraction: 0.74, maxWidth: 560, aspectRatio: 2 }

describe('launchImageBox', () => {
  test('takes the window fraction on a phone and the cap on a tablet', () => {
    expect(launchImageBox(hero, 400)).toEqual({ width: 296, height: 148 })
    expect(launchImageBox(hero, 1024)).toEqual({ width: 560, height: 280 })
  })

  test('a non-positive aspect ratio falls back to square', () => {
    expect(launchImageBox({ ...hero, aspectRatio: 0 }, 400)).toEqual({ width: 296, height: 296 })
  })
})
