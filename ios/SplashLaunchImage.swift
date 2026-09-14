import Foundation
import NitroModules
import UIKit

/**
 * The app-supplied launch picture, persisted in `UserDefaults` so it is there
 * before JavaScript is: the manager reads it while attaching the overlay,
 * which happens at `UIApplicationDidFinishLaunchingNotification`.
 */
enum SplashLaunchImageStore {
  private static let key = "dev.osuki.splash.launchImage"

  /**
   * iOS moves the app's data container to a new UUID on every update or
   * reinstall, so an absolute path saved before an update is dead after it.
   * Paths under the home directory are stored relative to it and re-rooted
   * on load; anything else is stored as given.
   */
  private static let homeMarker = "$HOME/"

  static func load() -> SplashLaunchImageSpec? {
    guard let dict = UserDefaults.standard.dictionary(forKey: key) else { return nil }
    guard let storedUri = dict["uri"] as? String,
          let backgroundColor = dict["backgroundColor"] as? String,
          let widthFraction = dict["widthFraction"] as? Double,
          let maxWidth = dict["maxWidth"] as? Double,
          let aspectRatio = dict["aspectRatio"] as? Double
    else { return nil }
    let uri = expandHome(storedUri)
    guard FileManager.default.fileExists(atPath: path(for: uri)) else { return nil }
    return SplashLaunchImageSpec(
      uri: uri,
      backgroundColor: backgroundColor,
      darkBackgroundColor: dict["darkBackgroundColor"] as? String,
      widthFraction: widthFraction,
      maxWidth: maxWidth,
      aspectRatio: aspectRatio
    )
  }

  static func save(_ image: SplashLaunchImageSpec) {
    var dict: [String: Any] = [
      "uri": contractHome(image.uri),
      "backgroundColor": image.backgroundColor,
      "widthFraction": image.widthFraction,
      "maxWidth": image.maxWidth,
      "aspectRatio": image.aspectRatio,
    ]
    if let dark = image.darkBackgroundColor { dict["darkBackgroundColor"] = dark }
    UserDefaults.standard.set(dict, forKey: key)
  }

  static func clear() {
    UserDefaults.standard.removeObject(forKey: key)
  }

  static func path(for uri: String) -> String {
    if let url = URL(string: uri), url.isFileURL { return url.path }
    return uri
  }

  /// `file:///…/Containers/Data/Application/<uuid>/Documents/x.png` -> `$HOME/Documents/x.png`.
  static func contractHome(_ uri: String) -> String {
    let home = NSHomeDirectory()
    let filePath = path(for: uri)
    guard filePath.hasPrefix(home + "/") else { return uri }
    return homeMarker + String(filePath.dropFirst(home.count + 1))
  }

  /// The inverse of `contractHome`, against the container this process runs in.
  static func expandHome(_ stored: String) -> String {
    guard stored.hasPrefix(homeMarker) else { return stored }
    return NSHomeDirectory() + "/" + String(stored.dropFirst(homeMarker.count))
  }
}

/// The overlay drawn for a launch image: the pack's paper with the picture
/// centred in a box sized by the same rule the JS mirror uses, so the handoff
/// stays pixel-identical.
final class SplashLaunchImageView: UIView {
  private let image: SplashLaunchImageSpec
  private let imageView = UIImageView()

  init(image: SplashLaunchImageSpec, frame: CGRect) {
    self.image = image
    super.init(frame: frame)
    backgroundColor = SplashLaunchImageView.backgroundColor(for: image)
    imageView.contentMode = .scaleAspectFit
    imageView.image = UIImage(contentsOfFile: SplashLaunchImageStore.path(for: image.uri))
    addSubview(imageView)
    autoresizingMask = [.flexibleWidth, .flexibleHeight]
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { nil }

  override func layoutSubviews() {
    super.layoutSubviews()
    let size = SplashLaunchImageView.box(for: image, in: bounds.size)
    imageView.bounds = CGRect(origin: .zero, size: size)
    imageView.center = CGPoint(x: bounds.midX, y: bounds.midY)
  }

  /// `min(width * fraction, maxWidth)` wide, `aspectRatio` tall. Mirrored in `use-splash-mirror.ts`.
  static func box(for image: SplashLaunchImageSpec, in container: CGSize) -> CGSize {
    let width = min(container.width * image.widthFraction, image.maxWidth)
    let ratio = image.aspectRatio > 0 ? image.aspectRatio : 1
    return CGSize(width: width, height: width / ratio)
  }

  static func backgroundColor(for image: SplashLaunchImageSpec) -> UIColor {
    let light = SplashManifest.color(hex: image.backgroundColor) ?? .systemBackground
    guard let darkHex = image.darkBackgroundColor, let dark = SplashManifest.color(hex: darkHex) else { return light }
    return UIColor { traits in traits.userInterfaceStyle == .dark ? dark : light }
  }
}
