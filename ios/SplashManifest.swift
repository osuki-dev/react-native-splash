import Foundation
import NitroModules
import UIKit

/**
 * Reads the manifest the config plugin / CLI wrote into `Info.plist` under
 * the `OsukiSplash` key, so JS can reproduce the launch screen without a
 * second copy of the colours and sizes.
 *
 * ```xml
 * <key>OsukiSplash</key>
 * <dict>
 *   <key>backgroundColor</key><string>#F7F3EC</string>
 *   <key>darkBackgroundColor</key><string>#050B12</string>
 *   <key>logoName</key><string>SplashScreenLogo</string>
 *   <key>logoWidth</key><integer>128</integer>
 *   <key>logoHeight</key><integer>128</integer>
 *   <key>autoHide</key><true/>
 *   <key>hideTimeoutMs</key><integer>15000</integer>
 * </dict>
 * ```
 */
enum SplashManifest {
  static let infoPlistKey = "OsukiSplash"

  static func load(from bundle: Bundle = .main) -> SplashManifestSpec {
    let dict = bundle.object(forInfoDictionaryKey: infoPlistKey) as? [String: Any] ?? [:]

    let backgroundColor = dict["backgroundColor"] as? String ?? "#ffffff"
    let darkBackgroundColor = dict["darkBackgroundColor"] as? String

    var logo: SplashLogoSpec? = nil
    if let name = dict["logoName"] as? String, !name.isEmpty {
      let width = doubleValue(dict["logoWidth"]) ?? 100
      let height = doubleValue(dict["logoHeight"]) ?? width
      logo = SplashLogoSpec(name: name, width: width, height: height)
    }
    // The imageset carries the dark appearance itself; UIKit picks it.
    let darkLogo: SplashLogoSpec? = (dict["hasDarkLogo"] as? Bool ?? false) ? logo : nil

    return SplashManifestSpec(
      launchImage: nil,
      backgroundColor: backgroundColor,
      darkBackgroundColor: darkBackgroundColor,
      logo: logo,
      darkLogo: darkLogo,
      logoSizeRatio: 1,
      statusBarHeight: 0,
      navigationBarHeight: 0,
      edgeToEdge: true,
      autoHide: dict["autoHide"] as? Bool ?? true,
      hideTimeoutMs: doubleValue(dict["hideTimeoutMs"]) ?? 15_000
    )
  }

  private static func doubleValue(_ value: Any?) -> Double? {
    if let number = value as? NSNumber { return number.doubleValue }
    if let string = value as? String { return Double(string) }
    return nil
  }

  /// `#RRGGBB` / `#RRGGBBAA` to UIColor; nil for anything else.
  static func color(hex: String) -> UIColor? {
    var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.hasPrefix("#") { text.removeFirst() }
    guard text.count == 6 || text.count == 8, let value = UInt64(text, radix: 16) else { return nil }
    let hasAlpha = text.count == 8
    let r = CGFloat((value >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
    let g = CGFloat((value >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
    let b = CGFloat((value >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
    let a = hasAlpha ? CGFloat(value & 0xFF) / 255 : 1
    return UIColor(red: r, green: g, blue: b, alpha: a)
  }

  /// A dynamic colour that follows light / dark mode like the storyboard's named colour does.
  static func backgroundColor(for manifest: SplashManifestSpec) -> UIColor {
    let light = color(hex: manifest.backgroundColor) ?? .systemBackground
    guard let darkHex = manifest.darkBackgroundColor, let dark = color(hex: darkHex) else { return light }
    return UIColor { traits in traits.userInterfaceStyle == .dark ? dark : light }
  }
}
