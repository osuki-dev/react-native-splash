import Foundation
import NitroModules

/// Nitro adapter over `SplashScreenManager`. Methods run on the JS thread;
/// the manager hops to the main thread where UIKit needs it.
final class HybridSplashScreen: HybridSplashScreenSpec {
  private let manager = SplashScreenManager.shared

  var manifest: SplashManifestSpec {
    manager.manifest
  }

  var launchInfo: SplashLaunchInfoSpec {
    manager.launchInfo()
  }

  func isVisible() throws -> Bool {
    manager.isVisible
  }

  func preventAutoHide() throws {
    manager.preventAutoHide()
  }

  func hide(options: SplashHideOptionsSpec) throws -> Promise<Void> {
    let promise = Promise<Void>()
    manager.hide(fade: options.fade, durationMs: options.durationMs) {
      promise.resolve()
    }
    return promise
  }

  func show() throws -> Promise<Void> {
    let promise = Promise<Void>()
    manager.show {
      promise.resolve()
    }
    return promise
  }

  func setEventListener(listener: @escaping (_ event: SplashNativeEvent) -> Void) throws {
    manager.eventListener = listener
  }

  func clearEventListener() throws {
    manager.eventListener = nil
  }
}
