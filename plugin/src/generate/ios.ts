import fs from 'node:fs'
import path from 'node:path'

import { colorComponents } from '../options'
import type { ResolvedSplash } from '../options'
import { contentHash, fileHash, resolveAsset, resizeSquare } from './image'
import type { ImageContext } from './image'

export const STORYBOARD_NAME = 'SplashScreen'
export const INFO_PLIST_KEY = 'OsukiSplash'
const LOGO_PREFIX = 'SplashScreenLogo'
const BACKGROUND_PREFIX = 'SplashScreenBackground'

export interface IosSplashOutput {
  /** Files written, relative to the iOS source root. */
  files: string[]
  storyboardPath: string
  logoName?: string
  backgroundName: string
  /** What goes under `OsukiSplash` in Info.plist. */
  infoPlistManifest: Record<string, string | number | boolean>
}

export interface IosGenerateContext extends ImageContext {
  /** `ios/<AppName>`: where Images.xcassets and the storyboard live. */
  iosSourceRoot: string
}

/**
 * Writes the storyboard, the logo imageset (light / dark / iPad, 1x–3x) and
 * the background colorset. Asset names carry a content hash so iOS never
 * shows a stale launch snapshot after a change.
 */
export async function generateIosSplash(ctx: IosGenerateContext, splash: ResolvedSplash): Promise<IosSplashOutput> {
  const image = splash.image ? resolveAsset(ctx.projectRoot, splash.image) : undefined
  const darkImage = splash.darkImage ? resolveAsset(ctx.projectRoot, splash.darkImage) : undefined
  const tabletImage = splash.tabletImage ? resolveAsset(ctx.projectRoot, splash.tabletImage) : undefined

  const hash = contentHash([
    splash.backgroundColor,
    splash.darkBackgroundColor,
    splash.imageWidth,
    fileHash(image),
    fileHash(darkImage),
    fileHash(tabletImage),
  ])
  const logoName = image ? `${LOGO_PREFIX}-${hash}` : undefined
  const backgroundName = `${BACKGROUND_PREFIX}-${hash}`
  const xcassets = path.join(ctx.iosSourceRoot, 'Images.xcassets')
  const files: string[] = []

  removeStale(xcassets, LOGO_PREFIX, '.imageset', logoName)
  removeStale(xcassets, BACKGROUND_PREFIX, '.colorset', backgroundName)

  if (image && logoName) {
    const imageset = path.join(xcassets, `${logoName}.imageset`)
    fs.mkdirSync(imageset, { recursive: true })
    const entries: Array<{ file: string; filename: string; idiom: 'universal' | 'ipad'; dark: boolean }> = [
      { file: image, filename: 'image', idiom: 'universal', dark: false },
    ]
    if (darkImage) entries.push({ file: darkImage, filename: 'dark_image', idiom: 'universal', dark: true })
    if (tabletImage) entries.push({ file: tabletImage, filename: 'tablet_image', idiom: 'ipad', dark: false })

    const contents: Array<Record<string, unknown>> = []
    for (const entry of entries) {
      const scales = entry.idiom === 'ipad' ? [1, 2] : [1, 2, 3]
      for (const scale of scales) {
        const suffix = scale === 1 ? '' : `@${scale}x`
        const filename = `${entry.filename}${suffix}.png`
        fs.writeFileSync(path.join(imageset, filename), await resizeSquare(ctx, entry.file, splash.imageWidth * scale))
        files.push(path.relative(ctx.iosSourceRoot, path.join(imageset, filename)))
        contents.push({
          idiom: entry.idiom,
          filename,
          scale: `${scale}x`,
          ...(entry.dark ? { appearances: [{ appearance: 'luminosity', value: 'dark' }] } : {}),
        })
      }
    }
    writeJson(path.join(imageset, 'Contents.json'), { images: contents, info: { version: 1, author: 'react-native-splash' } })
    files.push(path.relative(ctx.iosSourceRoot, path.join(imageset, 'Contents.json')))
  }

  const colorset = path.join(xcassets, `${backgroundName}.colorset`)
  fs.mkdirSync(colorset, { recursive: true })
  const colors: Array<Record<string, unknown>> = [colorEntry(splash.backgroundColor)]
  if (splash.darkBackgroundColor) {
    colors.push({ ...colorEntry(splash.darkBackgroundColor), appearances: [{ appearance: 'luminosity', value: 'dark' }] })
  }
  writeJson(path.join(colorset, 'Contents.json'), { colors, info: { version: 1, author: 'react-native-splash' } })
  files.push(path.relative(ctx.iosSourceRoot, path.join(colorset, 'Contents.json')))

  const storyboardPath = path.join(ctx.iosSourceRoot, `${STORYBOARD_NAME}.storyboard`)
  fs.writeFileSync(storyboardPath, buildStoryboard({ logoName, backgroundName, backgroundColor: splash.backgroundColor, logoSize: splash.imageWidth }))
  files.push(path.relative(ctx.iosSourceRoot, storyboardPath))

  return {
    files,
    storyboardPath,
    logoName,
    backgroundName,
    infoPlistManifest: buildInfoPlistManifest(splash, logoName, darkImage !== undefined),
  }
}

export function buildInfoPlistManifest(
  splash: ResolvedSplash,
  logoName: string | undefined,
  hasDarkLogo: boolean,
): Record<string, string | number | boolean> {
  const manifest: Record<string, string | number | boolean> = {
    backgroundColor: splash.backgroundColor,
    autoHide: splash.autoHide,
    hideTimeoutMs: splash.hideTimeoutMs,
  }
  if (splash.darkBackgroundColor) manifest.darkBackgroundColor = splash.darkBackgroundColor
  if (logoName) {
    manifest.logoName = logoName
    manifest.logoWidth = splash.imageWidth
    manifest.logoHeight = splash.imageWidth
    manifest.hasDarkLogo = hasDarkLogo
  }
  return manifest
}

/**
 * Same structure expo-splash-screen generates: one image view with centre
 * constraints, size from the image's intrinsic size, background from a
 * named colour. Launch storyboards may contain nothing more than this.
 */
export function buildStoryboard(args: { logoName?: string; backgroundName: string; backgroundColor: string; logoSize: number }): string {
  const { red, green, blue } = colorComponents(args.backgroundColor)
  const x = ((393 - args.logoSize) / 2).toFixed(1)
  const y = ((852 - args.logoSize) / 2).toFixed(1)
  const imageView = args.logoName
    ? `                        <subviews>
                            <imageView id="OSUKI-SplashLogo" userLabel="SplashScreenLogo" image="${args.logoName}" contentMode="scaleAspectFit" clipsSubviews="true" userInteractionEnabled="false" translatesAutoresizingMaskIntoConstraints="false">
                                <rect key="frame" x="${x}" y="${y}" width="${args.logoSize}" height="${args.logoSize}"/>
                            </imageView>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="OSUKI-SafeArea"/>
                        <constraints>
                            <constraint firstItem="OSUKI-SplashLogo" firstAttribute="centerX" secondItem="OSUKI-ContainerView" secondAttribute="centerX" id="OSUKI-CenterX"/>
                            <constraint firstItem="OSUKI-SplashLogo" firstAttribute="centerY" secondItem="OSUKI-ContainerView" secondAttribute="centerY" id="OSUKI-CenterY"/>
                        </constraints>
`
    : `                        <viewLayoutGuide key="safeArea" id="OSUKI-SafeArea"/>
`
  const imageResource = args.logoName
    ? `        <image name="${args.logoName}" width="${args.logoSize}" height="${args.logoSize}"/>
`
    : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="24093.7" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="OSUKI-VIEWCONTROLLER">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="24053.1"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="System colors in document resources" minToolsVersion="11.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="OSUKI-SCENE">
            <objects>
                <viewController storyboardIdentifier="SplashScreenViewController" id="OSUKI-VIEWCONTROLLER" sceneMemberID="viewController">
                    <view key="view" userInteractionEnabled="NO" contentMode="scaleToFill" insetsLayoutMarginsFromSafeArea="NO" id="OSUKI-ContainerView" userLabel="ContainerView">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
${imageView}                        <color key="backgroundColor" name="${args.backgroundName}"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="OSUKI-PLACEHOLDER" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="0.0" y="0.0"/>
        </scene>
    </scenes>
    <resources>
${imageResource}        <namedColor name="${args.backgroundName}">
            <color red="${red.toFixed(15)}" green="${green.toFixed(15)}" blue="${blue.toFixed(15)}" alpha="1.000" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>
    </resources>
</document>
`
}

function colorEntry(hex: string): Record<string, unknown> {
  const { red, green, blue } = colorComponents(hex)
  return {
    color: {
      'color-space': 'srgb',
      components: { alpha: '1.000', red: red.toFixed(15), green: green.toFixed(15), blue: blue.toFixed(15) },
    },
    idiom: 'universal',
  }
}

function removeStale(xcassets: string, prefix: string, suffix: string, keep: string | undefined): void {
  if (!fs.existsSync(xcassets)) return
  for (const entry of fs.readdirSync(xcassets)) {
    if (!entry.startsWith(prefix) || !entry.endsWith(suffix)) continue
    if (keep && entry === `${keep}${suffix}`) continue
    fs.rmSync(path.join(xcassets, entry), { recursive: true, force: true })
  }
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}
