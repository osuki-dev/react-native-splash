import { describe, expect, test } from 'bun:test'

import { setLauncherActivityTheme, upsertColor, upsertStyle } from './xml'

describe('upsertColor', () => {
  test('creates the document when missing', () => {
    const out = upsertColor(undefined as unknown as string, 'splashscreen_background', '#F7F3EC')
    expect(out).toContain('<resources>')
    expect(out).toContain('<color name="splashscreen_background">#F7F3EC</color>')
  })

  test('replaces an existing entry and keeps the others', () => {
    const input = '<resources>\n  <color name="splashscreen_background">#000000</color>\n  <color name="colorPrimary">#023c69</color>\n</resources>\n'
    const out = upsertColor(input, 'splashscreen_background', '#F7F3EC')
    expect(out.match(/splashscreen_background/g)).toHaveLength(1)
    expect(out).toContain('#F7F3EC')
    expect(out).toContain('colorPrimary')
  })
})

describe('upsertStyle', () => {
  test('replaces the whole style block', () => {
    const input = `<resources>
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="colorPrimary">@color/colorPrimary</item>
  </style>
  <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/old</item>
  </style>
</resources>
`
    const out = upsertStyle(input, 'Theme.App.SplashScreen', 'Theme.SplashScreen', [
      { name: 'windowSplashScreenBackground', value: '@color/splashscreen_background' },
      { name: 'postSplashScreenTheme', value: '@style/AppTheme' },
    ])
    expect(out).not.toContain('@color/old')
    expect(out).toContain('@style/AppTheme')
    expect(out.match(/<style name="AppTheme"/g)).toHaveLength(1)
  })
})

describe('setLauncherActivityTheme', () => {
  const manifest = `<manifest>
  <application>
    <activity android:name=".MainActivity" android:theme="@style/AppTheme" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
    <activity android:name=".Other" android:theme="@style/AppTheme"/>
  </application>
</manifest>`

  test('only touches the launcher activity', () => {
    const out = setLauncherActivityTheme(manifest, 'Theme.App.SplashScreen')
    expect(out).toContain('android:name=".MainActivity" android:theme="@style/Theme.App.SplashScreen"')
    expect(out).toContain('android:name=".Other" android:theme="@style/AppTheme"')
  })

  test('adds the attribute when missing', () => {
    const out = setLauncherActivityTheme(manifest.replace(' android:theme="@style/AppTheme" android:exported', ' android:exported'), 'X')
    expect(out).toContain('<activity android:theme="@style/X" android:name=".MainActivity"')
  })
})
