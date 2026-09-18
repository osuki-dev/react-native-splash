import { SplashOverlay, SplashScreen } from '@osuki-dev/react-native-splash'
import type { SplashPhase } from '@osuki-dev/react-native-splash'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native'

import {
  AnimeComicIntro,
  CircleRevealIntro,
  CreativeStudioIntro,
  CyberpunkGlitchIntro,
  FeatureShowcaseIntro,
  LogoRevealIntro,
  ModernHeroIntro,
  OnboardingIntro,
  PrismChromaticIntro,
  SplitCurtainIntro,
  TypographicIntro,
  ZoomFadeIntro,
} from '@osuki-dev/react-native-splash/intros'
import type { IntroProps } from '@osuki-dev/react-native-splash/intros'
import type { ComponentType } from 'react'

// Module scope: content can appear before the first effect runs.
SplashScreen.preventAutoHide()

const LOADING_MS = 2500

interface IntroStyle {
  id: string
  title: string
  description: string
  /** Waits for the user instead of a loading timer. */
  interactive: boolean
  component: ComponentType<IntroProps>
}

const INTROS: IntroStyle[] = [
  {
    id: 'cyber',
    title: 'Cyberpunk HUD',
    description: 'Holographic HUD matrix grid, CRT scanlines, neon glitch & laser collapse.',
    interactive: false,
    component: (props: IntroProps) => (
      <CyberpunkGlitchIntro
        {...props}
        title="CYBERPUNK"
        subtitle="NIGHT CITY // NETRUNNER"
        badge="SYS://ONLINE"
        hudCoordinates="SECTOR 04 // 0x7FA2"
        telemetryTags={['CORE: ONLINE', 'SYNC: 99.8%', 'PORT: 8081']}
        colors={{
          background: '#08080C',
          neonYellow: '#FFE600',
          neonCyan: '#00F0FF',
          neonPink: '#FF0055',
        }}
      />
    ),
  },
  {
    id: 'anime',
    title: 'Anime comic',
    description: 'Radial action speedlines, floating Sakura petals & diagonal banner slash.',
    interactive: false,
    component: (props: IntroProps) => (
      <AnimeComicIntro
        {...props}
        title="NEO TOKYO"
        subtitle="READY FOR ADVENTURE"
        japaneseBadge="「 新次元の扉 」"
        colors={{
          background: '#0D0B18',
          accent: '#FF4081',
          accentSecondary: '#8C52FF',
          speedlines: '#FF4081',
        }}
      />
    ),
  },
  {
    id: 'studio',
    title: 'Creative studio',
    description: 'Kinetic focus brackets, liquid aura mesh & live status ticker.',
    interactive: false,
    component: (props: IntroProps) => (
      <CreativeStudioIntro
        {...props}
        title="CREATIVE STUDIO"
        subtitle="v2026.4 • MOTION SUITE"
        statusSteps={[
          'Initializing GPU Pipeline...',
          'Loading Creative Presets...',
          'Calibrating Color Profiles...',
          'Workspace Ready',
        ]}
        colors={{
          background: '#0B0D17',
          cardBackground: '#141727',
          accent: '#6366F1',
          auraColors: ['#4F46E5', '#D946EF'],
        }}
      />
    ),
  },
  {
    id: 'prism',
    title: 'Prism chromatic',
    description: 'RGB chromatic aberration glitch, shockwave ring & lens flare.',
    interactive: false,
    component: (props: IntroProps) => (
      <PrismChromaticIntro
        {...props}
        badge="OPTICAL PIPELINE"
        title="PRISM ENGINE"
        subtitle="GPU-ACCELERATED MOTION CORE"
        colors={{
          background: '#07080E',
          chromaticCyan: '#00F0FF',
          chromaticRed: '#FF1F6D',
          glow: '#00F0FF',
        }}
      />
    ),
  },
  {
    id: 'split',
    title: 'Split curtain',
    description: 'Theatrical split screen doors slide apart with center brand mark.',
    interactive: false,
    component: (props: IntroProps) => (
      <SplitCurtainIntro
        {...props}
        badge="WELCOME"
        title="Lumina Studio"
        subtitle="Crafted for creators & modern teams."
      />
    ),
  },
  {
    id: 'showcase',
    title: 'Feature showcase',
    description: 'Staggered cascade of rich feature cards with icons and typography.',
    interactive: true,
    component: (props: IntroProps) => (
      <FeatureShowcaseIntro
        {...props}
        interactive
        title="What's New"
        subtitle="Experience faster transitions"
      />
    ),
  },
  {
    id: 'zoom',
    title: 'Spatial zoom',
    description: 'Elastic bounce and ambient halo with camera fly-through zoom.',
    interactive: false,
    component: (props: IntroProps) => (
      <ZoomFadeIntro
        {...props}
        badge="POWERED BY NITRO"
        title="Spatial Engine"
        tagline="Zero frame flash with instant native handoff."
      />
    ),
  },
  {
    id: 'hero',
    title: 'Modern hero',
    description: 'Staggered pill chips, typography, and directional screen split.',
    interactive: false,
    component: (props: IntroProps) => (
      <ModernHeroIntro
        {...props}
        title="Designed to Perform"
        subtitle="Fast, resilient, and beautifully responsive."
      />
    ),
  },
  { id: 'logo', title: 'Logo reveal', description: 'Breathes while loading, ripples and scales away.', interactive: false, component: LogoRevealIntro },
  { id: 'circle', title: 'Circle reveal', description: 'The background collapses into the logo, revealing the app from the edges.', interactive: false, component: CircleRevealIntro },
  { id: 'type', title: 'Typographic', description: 'Tagline lands word by word, then the sheet lifts like a curtain.', interactive: false, component: TypographicIntro },
  { id: 'onboarding', title: 'Onboarding', description: 'Three swipeable pages with parallax; ready when you tap Get started.', interactive: true, component: OnboardingIntro },
]

export default function App() {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'

  // Which intro runs, and a run counter so replays remount the overlay.
  const [intro, setIntro] = useState<IntroStyle>(INTROS[0]!)
  const [run, setRun] = useState(0)
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<SplashPhase>('native')
  const [log, setLog] = useState<string[]>([])

  const append = (line: string) => setLog((lines) => [...lines.slice(-11), `${new Date().toISOString().slice(11, 23)} ${line}`])

  // Non-interactive intros wait for a pretend load; interactive ones wait for the user.
  useEffect(() => {
    setReady(false)
    if (intro.interactive) return
    const timer = setTimeout(() => setReady(true), LOADING_MS)
    return () => clearTimeout(timer)
  }, [intro, run])

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

  /** Bring the native overlay back, then remount the JS overlay with another style. */
  const replay = (next: IntroStyle) => {
    void SplashScreen.show().then(() => {
      setIntro(next)
      setRun((value) => value + 1)
    })
  }

  const launchInfo = SplashScreen.getLaunchInfo()
  const manifest = SplashScreen.getManifest()
  const Intro = intro.component

  return (
    <View style={[styles.screen, dark && styles.screenDark]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, dark && styles.textDark]}>react-native-splash</Text>
        <Text style={[styles.caption, dark && styles.textDark]}>
          {intro.title} · phase {phase}
        </Text>

        <Section title="Replay with another intro" dark={dark}>
          <View style={styles.grid}>
            {INTROS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => replay(item)}
                style={({ pressed }) => [styles.card, dark && styles.cardDark, item.id === intro.id && styles.cardActive, pressed && styles.cardPressed]}
              >
                <Text style={[styles.cardTitle, dark && styles.textDark]}>{item.title}</Text>
                <Text style={[styles.cardBody, dark && styles.textMutedDark]}>{item.description}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

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
      </ScrollView>

      <SplashOverlay
        key={run}
        ready={ready}
        minimumDuration={intro.interactive ? 0 : 500}
        // An onboarding waits for the user; the safety cap is for loading gates.
        timeout={intro.interactive ? 0 : 15_000}
        onPhaseChange={setPhase}
      >
        {(context) => <Intro {...context} onDone={() => setReady(true)} />}
      </SplashOverlay>
    </View>
  )
}

function Section({ title, dark, children }: { title: string; dark: boolean; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, dark && styles.textMutedDark]}>{title}</Text>
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
  content: { padding: 24, paddingTop: 72, gap: 22 },
  title: { fontSize: 28, fontWeight: '700', color: '#1A2027' },
  caption: { fontSize: 15, color: '#5B6672' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#5B6672' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexBasis: '47%', flexGrow: 1, borderRadius: 10, padding: 12, gap: 4, backgroundColor: '#F1F3F6', borderWidth: 2, borderColor: 'transparent' },
  cardDark: { backgroundColor: '#1B222B' },
  cardActive: { borderColor: '#2D4FCB' },
  cardPressed: { opacity: 0.8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A2027' },
  cardBody: { fontSize: 12.5, lineHeight: 17, color: '#5B6672' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14, color: '#1A2027' },
  mono: { fontSize: 12.5, fontFamily: 'Menlo', color: '#1A2027' },
  textDark: { color: '#E6EAF0' },
  textMutedDark: { color: '#98A3B0' },
})
