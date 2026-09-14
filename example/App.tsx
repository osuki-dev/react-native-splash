import { SplashOverlay, SplashScreen, useSplashMirror } from '@osuki-dev/react-native-splash'
import type { SplashPhase, SplashRenderContext } from '@osuki-dev/react-native-splash'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// Module scope: content can appear before the first effect runs.
SplashScreen.preventAutoHide()

/**
 * The user-side splash: a pixel-identical mirror of the launch screen that
 * pulses while the app "loads", then scales the logo up and fades away.
 * Reanimated lives entirely here; the library only says when.
 */
function BrandSplash({ phase, finish }: SplashRenderContext) {
  const mirror = useSplashMirror()
  const exit = useSharedValue(0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (phase === 'visible') {
      pulse.value = withDelay(150, withTiming(1.08, { duration: 500, easing: Easing.inOut(Easing.quad) }))
      return
    }
    if (phase !== 'exiting') return
    exit.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(finish)
    })
  }, [phase, exit, pulse, finish])

  const container = useAnimatedStyle(() => ({ opacity: 1 - exit.value }))
  const logo = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * (1 + exit.value * 0.6) }],
  }))

  return (
    <Animated.View style={[mirror.container.style, container]}>
      {mirror.hasLogo ? <Animated.Image {...mirror.logo} style={[mirror.logo.style, logo]} /> : null}
    </Animated.View>
  )
}

export default function App() {
  const scheme = useColorScheme()
  const [ready, setReady] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [phase, setPhase] = useState<SplashPhase>('native')

  // Pretend to load fonts / settings.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 900)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const subscriptions = [
      SplashScreen.addListener('phase', ({ previous, phase }) => append(`phase ${previous} -> ${phase}`)),
      SplashScreen.addListener('nativeHidden', () => append('nativeHidden')),
      SplashScreen.addListener('hidden', ({ durationMs }) => append(`hidden after ${durationMs} ms`)),
      SplashScreen.addListener('timeout', ({ source }) => append(`timeout (${source})`)),
      SplashScreen.addListener('error', ({ reason }) => append(`error ${reason}`)),
    ]
    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [])

  const append = (line: string) => setLog((lines) => [...lines, `${new Date().toISOString().slice(11, 23)} ${line}`])
  const launchInfo = SplashScreen.getLaunchInfo()
  const manifest = SplashScreen.getManifest()
  const dark = scheme === 'dark'

  return (
    <View style={[styles.screen, dark && styles.screenDark]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, dark && styles.textDark]}>react-native-splash</Text>
        <Text style={[styles.caption, dark && styles.textDark]}>phase: {phase}</Text>

        <Section title="Launch info" dark={dark}>
          {Object.entries(launchInfo).map(([key, value]) => (
            <Row key={key} label={key} value={String(value)} dark={dark} />
          ))}
        </Section>

        <Section title="Manifest" dark={dark}>
          <Row label="backgroundColor" value={manifest.backgroundColor} dark={dark} />
          <Row label="darkBackgroundColor" value={manifest.darkBackgroundColor ?? '-'} dark={dark} />
          <Row label="logo" value={manifest.logo ? `${manifest.logo.name} ${manifest.logo.width}x${manifest.logo.height}` : '-'} dark={dark} />
          <Row label="logoSizeRatio" value={String(manifest.logoSizeRatio)} dark={dark} />
          <Row label="edgeToEdge" value={String(manifest.edgeToEdge)} dark={dark} />
        </Section>

        <Section title="Events" dark={dark}>
          {log.map((line, index) => (
            <Text key={index} style={[styles.mono, dark && styles.textDark]}>
              {line}
            </Text>
          ))}
        </Section>

        <Pressable
          style={styles.button}
          onPress={() => {
            void SplashScreen.show().then(() => {
              append('show() resolved')
              setTimeout(() => void SplashScreen.hide({ fade: true, duration: 400 }), 1200)
            })
          }}
        >
          <Text style={styles.buttonText}>Show native overlay again (1.2 s, then fade)</Text>
        </Pressable>
      </ScrollView>

      <SplashOverlay ready={ready} minimumDuration={600} onPhaseChange={setPhase}>
        {(context) => <BrandSplash {...context} />}
      </SplashOverlay>
    </View>
  )
}

function Section({ title, dark, children }: { title: string; dark: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, dark && styles.textDark]}>{title}</Text>
      {children}
    </View>
  )
}

function Row({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, dark && styles.textDark]}>{label}</Text>
      <Text style={[styles.mono, dark && styles.textDark]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  screenDark: { backgroundColor: '#101418' },
  content: { padding: 24, paddingTop: 72, gap: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1A2027' },
  caption: { fontSize: 15, color: '#5B6672' },
  section: { gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#5B6672' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14, color: '#1A2027' },
  mono: { fontSize: 13, fontFamily: 'Menlo', color: '#1A2027' },
  textDark: { color: '#E6EAF0' },
  button: { backgroundColor: '#2D4FCB', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
})
