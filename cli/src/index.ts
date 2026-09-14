import plist from '@expo/plist'
import fs from 'node:fs'
import path from 'node:path'
import xcode from 'xcode'

import { generateAndroidDrawables, BACKGROUND_COLOR, SPLASH_THEME, SPLASH_THEME_PARENT, splashStyleItems } from '../../plugin/src/generate/android'
import { INFO_PLIST_KEY, STORYBOARD_NAME, generateIosSplash } from '../../plugin/src/generate/ios'
import { ensureResourcesDocument, setLauncherActivityTheme, upsertColor, upsertStyle } from '../../plugin/src/generate/xml'
import { resolveSplashOptions } from '../../plugin/src/options'
import type { SplashOptions } from '../../plugin/src/options'

/**
 * `npx react-native-splash generate [--config splash.config.js] [--platforms ios,android] [flags]`
 *
 * Bare React Native has no install hook, so this is the one manual step: it
 * writes the same files the Expo config plugin does. Runtime hooks need no
 * AppDelegate / MainActivity edits.
 */

export const commandOptions = [
  { name: '--config <path>', description: 'Options file (default: splash.config.js or splash.config.json)' },
  { name: '--platforms <list>', description: 'ios,android (default: both)' },
  { name: '--logo <path>', description: 'Logo image (1024x1024 PNG recommended)' },
  { name: '--logo-width <dp>', description: 'Logical logo width, default 100' },
  { name: '--background <hex>', description: 'Background colour, default #ffffff' },
  { name: '--dark-logo <path>', description: 'Dark mode logo' },
  { name: '--dark-background <hex>', description: 'Dark mode background colour' },
  { name: '--project-root <path>', description: 'Defaults to the current directory' },
]

interface ParsedArgs {
  command: string | undefined
  flags: Record<string, string | boolean>
}

export async function main(argv: string[]): Promise<void> {
  const { command, flags } = parseArgs(argv)
  if (command === undefined || command === 'help' || flags.help === true) {
    printHelp()
    return
  }
  if (command !== 'generate') {
    throw new Error(`Unknown command "${command}". Run "react-native-splash help".`)
  }
  await run([], flags)
}

/** Entry point shared with the `react-native splash-generate` CLI command. */
export async function run(_argv: string[], flags: Record<string, string | boolean>): Promise<void> {
  const projectRoot = path.resolve(typeof flags['project-root'] === 'string' ? flags['project-root'] : process.cwd())
  const options = loadOptions(projectRoot, flags)
  const platforms = String(flags.platforms ?? 'ios,android')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (platforms.includes('ios')) await generateIos(projectRoot, options)
  if (platforms.includes('android')) await generateAndroid(projectRoot, options)
  console.log('[react-native-splash] done. Rebuild the app; iOS may need a device restart to drop its launch-screen snapshot cache.')
}

// ---------------------------------------------------------------------------
// iOS
// ---------------------------------------------------------------------------

async function generateIos(projectRoot: string, options: SplashOptions): Promise<void> {
  const splash = resolveSplashOptions(options, 'ios')
  const iosRoot = path.join(projectRoot, 'ios')
  const xcodeproj = fs.existsSync(iosRoot) ? fs.readdirSync(iosRoot).find((entry) => entry.endsWith('.xcodeproj')) : undefined
  if (!xcodeproj) {
    throw new Error(`[react-native-splash] no .xcodeproj found in ${iosRoot}`)
  }
  const projectName = xcodeproj.replace(/\.xcodeproj$/, '')
  const iosSourceRoot = path.join(iosRoot, projectName)

  const output = await generateIosSplash({ projectRoot, iosSourceRoot }, splash)
  output.files.forEach((file) => console.log(`  wrote ios/${projectName}/${file}`))

  // Info.plist
  const plistPath = path.join(iosSourceRoot, 'Info.plist')
  const info = plist.parse(fs.readFileSync(plistPath, 'utf8')) as Record<string, unknown>
  info.UILaunchStoryboardName = STORYBOARD_NAME
  info[INFO_PLIST_KEY] = output.infoPlistManifest
  if (splash.darkBackgroundColor || splash.darkImage) info.UIUserInterfaceStyle = 'Automatic'
  fs.writeFileSync(plistPath, plist.build(info))
  console.log(`  updated ios/${projectName}/Info.plist`)

  // pbxproj: make sure the storyboard is a resource of the app target.
  const pbxprojPath = path.join(iosRoot, xcodeproj, 'project.pbxproj')
  const project = xcode.project(pbxprojPath)
  project.parseSync()
  const relative = path.join(projectName, `${STORYBOARD_NAME}.storyboard`)
  if (!project.hasFile(relative)) {
    const target = project.getFirstTarget()
    const groupKey = project.findPBXGroupKey({ name: projectName }) ?? project.findPBXGroupKey({ path: projectName })
    project.addResourceFile(relative, { target: target.uuid }, groupKey)
    fs.writeFileSync(pbxprojPath, project.writeSync())
    console.log(`  registered ${relative} in ${xcodeproj}`)
  }
}

// ---------------------------------------------------------------------------
// Android
// ---------------------------------------------------------------------------

async function generateAndroid(projectRoot: string, options: SplashOptions): Promise<void> {
  const splash = resolveSplashOptions(options, 'android')
  const mainRoot = path.join(projectRoot, 'android', 'app', 'src', 'main')
  const resRoot = path.join(mainRoot, 'res')
  if (!fs.existsSync(mainRoot)) {
    throw new Error(`[react-native-splash] ${mainRoot} does not exist`)
  }

  const output = await generateAndroidDrawables({ projectRoot, resRoot, warn: console.warn }, splash)
  output.files.forEach((file) => console.log(`  wrote android/app/src/main/res/${file}`))

  editResource(path.join(resRoot, 'values', 'colors.xml'), (text) => upsertColor(text, BACKGROUND_COLOR, splash.backgroundColor))
  editResource(path.join(resRoot, 'values-night', 'colors.xml'), (text) =>
    upsertColor(text, BACKGROUND_COLOR, splash.darkBackgroundColor ?? splash.backgroundColor),
  )
  editResource(path.join(resRoot, 'values', 'styles.xml'), (text) =>
    upsertStyle(text, SPLASH_THEME, SPLASH_THEME_PARENT, splashStyleItems(splash, output.hasLogo)),
  )

  const manifestPath = path.join(mainRoot, 'AndroidManifest.xml')
  fs.writeFileSync(manifestPath, setLauncherActivityTheme(fs.readFileSync(manifestPath, 'utf8'), SPLASH_THEME))
  console.log('  updated android/app/src/main/AndroidManifest.xml')
}

function editResource(file: string, edit: (text: string) => string): void {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, edit(ensureResourcesDocument(existing)))
  console.log(`  updated ${path.relative(process.cwd(), file)}`)
}

// ---------------------------------------------------------------------------
// Options and args
// ---------------------------------------------------------------------------

function loadOptions(projectRoot: string, flags: Record<string, string | boolean>): SplashOptions {
  let fromFile: SplashOptions = {}
  const configFlag = typeof flags.config === 'string' ? flags.config : undefined
  const candidates = configFlag ? [path.resolve(projectRoot, configFlag)] : ['splash.config.js', 'splash.config.json'].map((f) => path.join(projectRoot, f))
  const configPath = candidates.find((file) => fs.existsSync(file))
  if (configFlag && !configPath) {
    throw new Error(`[react-native-splash] config file not found: ${configFlag}`)
  }
  if (configPath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require(configPath) as SplashOptions | { default: SplashOptions }
    fromFile = 'default' in loaded && loaded.default ? loaded.default : (loaded as SplashOptions)
  }

  const fromFlags: SplashOptions = {}
  if (typeof flags.logo === 'string') fromFlags.image = flags.logo
  if (typeof flags['logo-width'] === 'string') fromFlags.imageWidth = Number(flags['logo-width'])
  if (typeof flags.background === 'string') fromFlags.backgroundColor = flags.background
  if (typeof flags['dark-logo'] === 'string' || typeof flags['dark-background'] === 'string') {
    fromFlags.dark = {
      ...(typeof flags['dark-logo'] === 'string' ? { image: flags['dark-logo'] } : {}),
      ...(typeof flags['dark-background'] === 'string' ? { backgroundColor: flags['dark-background'] } : {}),
    }
  }

  const merged: SplashOptions = { ...fromFile, ...fromFlags, dark: { ...fromFile.dark, ...fromFlags.dark } }
  if (!merged.image) {
    throw new Error('[react-native-splash] no logo configured: pass --logo or set "image" in splash.config.js')
  }
  return merged
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {}
  let command: string | undefined
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? ''
    if (arg.startsWith('--')) {
      const [key, inlineValue] = arg.slice(2).split('=', 2)
      if (key === undefined) continue
      if (inlineValue !== undefined) {
        flags[key] = inlineValue
      } else {
        const next = argv[i + 1]
        if (next !== undefined && !next.startsWith('--')) {
          flags[key] = next
          i += 1
        } else {
          flags[key] = true
        }
      }
    } else if (command === undefined) {
      command = arg
    }
  }
  return { command, flags }
}

function printHelp(): void {
  console.log(`react-native-splash

Usage:
  react-native-splash generate [options]

Options:
${commandOptions.map((option) => `  ${option.name.padEnd(24)} ${option.description}`).join('\n')}

splash.config.js takes the same options as the Expo config plugin:
  module.exports = { image: './assets/logo.png', imageWidth: 128, backgroundColor: '#F7F3EC', dark: { ... } }
`)
}
