import { IOSConfig, withDangerousMod, withInfoPlist, withXcodeProject } from 'expo/config-plugins'
import type { ConfigPlugin } from 'expo/config-plugins'
import path from 'node:path'

import { INFO_PLIST_KEY, STORYBOARD_NAME, buildInfoPlistManifest, generateIosSplash } from './generate/ios'
import { contentHash, fileHash, resolveAsset } from './generate/image'
import type { ResolvedSplash } from './options'

export const withIosSplash: ConfigPlugin<ResolvedSplash> = (config, splash) => {
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosSourceRoot = IOSConfig.Paths.getSourceRoot(config.modRequest.projectRoot)
      await generateIosSplash({ projectRoot: config.modRequest.projectRoot, iosSourceRoot }, splash)
      return config
    },
  ])

  config = withInfoPlist(config, (config) => {
    // Same hash the generator derives, so the plist names the imageset that exists.
    const hash = iosAssetHash(config.modRequest.projectRoot, splash)
    const logoName = splash.image ? `SplashScreenLogo-${hash}` : undefined
    config.modResults.UILaunchStoryboardName = STORYBOARD_NAME
    config.modResults[INFO_PLIST_KEY] = buildInfoPlistManifest(splash, logoName, splash.darkImage !== undefined)
    if (splash.darkBackgroundColor || splash.darkImage) {
      // Without this the dark variants never show.
      if (config.modResults.UIUserInterfaceStyle && config.modResults.UIUserInterfaceStyle !== 'Automatic') {
        console.warn(
          `[react-native-splash] dark splash assets are configured but UIUserInterfaceStyle is "${String(config.modResults.UIUserInterfaceStyle)}"; set userInterfaceStyle to "automatic" in app.json.`,
        )
      }
      config.modResults.UIUserInterfaceStyle = 'Automatic'
    }
    return config
  })

  config = withXcodeProject(config, (config) => {
    const project = config.modResults
    const storyboardPath = path.join(config.modRequest.projectName ?? '', `${STORYBOARD_NAME}.storyboard`)
    if (!project.hasFile(storyboardPath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: storyboardPath,
        groupName: config.modRequest.projectName ?? '',
        project,
        isBuildFile: true,
      })
    }
    return config
  })

  return config
}

function iosAssetHash(projectRoot: string, splash: ResolvedSplash): string {
  const image = splash.image ? resolveAsset(projectRoot, splash.image) : undefined
  const darkImage = splash.darkImage ? resolveAsset(projectRoot, splash.darkImage) : undefined
  const tabletImage = splash.tabletImage ? resolveAsset(projectRoot, splash.tabletImage) : undefined
  return contentHash([
    splash.backgroundColor,
    splash.darkBackgroundColor,
    splash.imageWidth,
    fileHash(image),
    fileHash(darkImage),
    fileHash(tabletImage),
  ])
}
