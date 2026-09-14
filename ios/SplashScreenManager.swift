import Foundation
import NitroModules
import UIKit
import os

/**
 * Owns the native overlay for the whole process. It exists before the JS
 * runtime and survives dev reloads; `HybridSplashScreen` is a thin adapter
 * over it.
 *
 * Attachment strategy (in order):
 * 1. React Native's `RCTSurfaceHostingProxyRootView.loadingView` slot, with
 *    `disableActivityIndicatorAutoHide(true)` so RN keeps the view above the
 *    surface. This is the slot expo-splash-screen and bootsplash use. It is
 *    reached through the Objective-C runtime so this pod does not need React
 *    headers and keeps working across RN versions.
 * 2. Otherwise a subview on top of the key window (react-native-navigation,
 *    brownfield hosts, and every app whose root view arrives late).
 *
 * A late root view is the ordinary case with expo-updates: at launch the
 * window holds a placeholder, and the real `RCTSurfaceHostingProxyRootView`
 * replaces the whole root view controller once the update check is done. A
 * window subview is not guaranteed to stay above that swap, so after
 * attaching the manager keeps watching the window until the overlay is gone:
 * the moment a hosting root view appears the overlay moves into its
 * `loadingView` slot, and until then it is kept in front of whatever the host
 * app inserts.
 *
 * The overlay is the launch storyboard itself, instantiated by name, so it is
 * pixel-identical to what the system just showed.
 *
 * `log stream --predicate 'subsystem == "dev.osuki.splash"'` shows what it did.
 */
@objc(OsukiSplashScreenManager)
public final class SplashScreenManager: NSObject {
  @objc public static let shared = SplashScreenManager()

  /// How long the system launch screen keeps cross-fading after our view is
  /// up. Removing ours earlier flashes the app underneath.
  private static let systemFadeGuard: TimeInterval = 0.35
  /// How often the window is re-checked for a late root view while the overlay is up.
  private static let hostWatchInterval: TimeInterval = 0.1

  private static let log = Logger(subsystem: "dev.osuki.splash", category: "manager")

  public let manifest: SplashManifestSpec = SplashManifest.load()
  public var eventListener: ((SplashNativeEvent) -> Void)?

  private var overlay: UIView?
  private weak var hostRootView: UIView?
  private var overlayVisible = false
  private var attachedAt: Date?
  private var fadeGuardActive = false
  private var pendingHides: [(fade: Bool, durationMs: Double, completion: () -> Void)] = []
  private var showCount = 0
  private var contentAppearedCount = 0
  private var autoHidePrevented = false
  private var observersInstalled = false
  private var timeoutWork: DispatchWorkItem?
  private var hostWatch: DispatchSourceTimer?
  private let processStart = Date()
  private let lock = NSLock()

  private override init() {
    super.init()
  }

  // MARK: - Entry points (main thread)

  /// Called by `SplashLaunchHook` once the app finished launching, and again
  /// whenever a window becomes key until the overlay is attached.
  @objc public func applicationDidFinishLaunching() {
    guard !Self.isRunningInAppExtension else { return }
    installObserversIfNeeded()
    attachIfPossible()
  }

  /// Explicit hook for hosts where the notification path cannot find the
  /// root view (custom factories, brownfield). Idempotent.
  @objc public func install(rootView: UIView) {
    guard !Self.isRunningInAppExtension else { return }
    installObserversIfNeeded()
    hostRootView = rootView
    attachIfPossible()
  }

  // MARK: - State (any thread)

  public var isVisible: Bool {
    lock.lock(); defer { lock.unlock() }
    return overlayVisible
  }

  public func launchInfo() -> SplashLaunchInfoSpec {
    lock.lock(); defer { lock.unlock() }
    let style = UITraitCollection.current.userInterfaceStyle
    return SplashLaunchInfoSpec(
      coldStart: showCount <= 1,
      reload: contentAppearedCount > 1,
      systemSplashShown: true,
      processStartMs: processStart.timeIntervalSince1970 * 1000,
      overlayAttachedMs: (attachedAt?.timeIntervalSince1970 ?? 0) * 1000,
      colorScheme: style == .dark ? .dark : .light
    )
  }

  public func preventAutoHide() {
    lock.lock(); defer { lock.unlock() }
    autoHidePrevented = true
  }

  public func hide(fade: Bool, durationMs: Double, completion: @escaping () -> Void) {
    DispatchQueue.main.async { [self] in
      guard overlayVisible, let overlay else {
        completion()
        return
      }
      if fadeGuardActive {
        pendingHides.append((fade, durationMs, completion))
        return
      }
      performHide(overlay, fade: fade, durationMs: durationMs, completion: completion)
    }
  }

  public func show(completion: @escaping () -> Void) {
    DispatchQueue.main.async { [self] in
      if overlayVisible {
        completion()
        return
      }
      attachIfPossible()
      if overlayVisible { emit(.shown) }
      completion()
    }
  }

  // MARK: - Attach

  private func attachIfPossible() {
    guard overlay == nil else { return }
    guard let window = Self.keyWindow() else { return }
    guard let view = Self.instantiateLaunchScreen() else { return }

    let host = hostRootView ?? Self.findHostRootView(in: window)
    view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    if let host, attach(view, toHost: host) {
      hostRootView = host
      host.backgroundColor = SplashManifest.backgroundColor(for: manifest)
      Self.log.info("attached to the React Native root view")
    } else {
      view.frame = window.bounds
      window.addSubview(view)
      Self.log.info("attached to the window; no React Native root view yet")
    }
    window.backgroundColor = SplashManifest.backgroundColor(for: manifest)

    lock.lock()
    overlay = view
    overlayVisible = true
    attachedAt = Date()
    showCount += 1
    lock.unlock()

    startFadeGuard()
    scheduleTimeout()
    startHostWatch()
    emit(.attached)
  }

  /// Keeps the overlay on top while the host app is still assembling its
  /// view hierarchy. Cheap: one subview walk every 100 ms, only while visible.
  private func startHostWatch() {
    stopHostWatch()
    let timer = DispatchSource.makeTimerSource(queue: .main)
    timer.schedule(deadline: .now() + Self.hostWatchInterval, repeating: Self.hostWatchInterval)
    timer.setEventHandler { [weak self] in self?.watchHost() }
    timer.resume()
    hostWatch = timer
  }

  private func stopHostWatch() {
    hostWatch?.cancel()
    hostWatch = nil
  }

  private func watchHost() {
    guard overlayVisible, let overlay else {
      stopHostWatch()
      return
    }
    // Already in a live root view's loadingView slot: nothing to do.
    if let host = hostRootView, host.window != nil, overlay.isDescendant(of: host) { return }
    guard let window = overlay.window ?? Self.keyWindow() else { return }
    if let host = Self.findHostRootView(in: window), attach(overlay, toHost: host) {
      hostRootView = host
      host.backgroundColor = SplashManifest.backgroundColor(for: manifest)
      Self.log.info("root view arrived; overlay moved into its loadingView slot")
      return
    }
    // Still window-level: stay above whatever the host app just inserted.
    if overlay.superview === window {
      if window.subviews.last !== overlay { window.bringSubviewToFront(overlay) }
    } else if overlay.superview == nil {
      overlay.frame = window.bounds
      window.addSubview(overlay)
      Self.log.info("overlay had been detached by the host app; re-added to the window")
    }
  }

  /// `loadingView` is a factory on the hosting view; setting it while the
  /// activity indicator is visible re-creates the view, so a late attach
  /// (after `customizeRootView` has already run) still lands.
  private func attach(_ view: UIView, toHost host: UIView) -> Bool {
    let disableSelector = NSSelectorFromString("disableActivityIndicatorAutoHide:")
    let loadingSelector = NSSelectorFromString("setLoadingView:")
    guard host.responds(to: disableSelector), host.responds(to: loadingSelector) else { return false }
    Self.callBoolSetter(host, selector: disableSelector, value: true)
    host.setValue(view, forKey: "loadingView")
    return view.superview != nil
  }

  private func performHide(_ overlay: UIView, fade: Bool, durationMs: Double, completion: @escaping () -> Void) {
    lock.lock()
    overlayVisible = false
    self.overlay = nil
    lock.unlock()
    timeoutWork?.cancel()
    timeoutWork = nil
    stopHostWatch()
    Self.log.info("hiding (fade: \(fade))")

    let finish = { [self] in
      overlay.removeFromSuperview()
      if let host = hostRootView {
        // Hand the slot back so RN's own activity-indicator logic resumes.
        Self.callBoolSetter(host, selector: NSSelectorFromString("disableActivityIndicatorAutoHide:"), value: false)
      }
      emit(.hidden)
      completion()
    }

    if fade, let container = overlay.superview {
      UIView.transition(with: container, duration: durationMs / 1000, options: [.transitionCrossDissolve]) {
        overlay.isHidden = true
      } completion: { _ in finish() }
    } else {
      finish()
    }
  }

  // MARK: - Observers

  private func installObserversIfNeeded() {
    guard !observersInstalled else { return }
    observersInstalled = true
    let center = NotificationCenter.default
    center.addObserver(self, selector: #selector(onWindowBecameKey), name: UIWindow.didBecomeKeyNotification, object: nil)
    center.addObserver(self, selector: #selector(onContentDidAppear), name: Notification.Name("RCTContentDidAppearNotification"), object: nil)
    center.addObserver(self, selector: #selector(onJavaScriptDidFailToLoad), name: Notification.Name("RCTJavaScriptDidFailToLoadNotification"), object: nil)
    center.addObserver(self, selector: #selector(onReloadCommand), name: Notification.Name("RCTTriggerReloadCommandNotification"), object: nil)
    center.addObserver(self, selector: #selector(onJavaScriptWillStartLoading), name: Notification.Name("RCTJavaScriptWillStartLoadingNotification"), object: nil)
  }

  @objc private func onWindowBecameKey() {
    attachIfPossible()
  }

  @objc private func onContentDidAppear() {
    lock.lock()
    contentAppearedCount += 1
    let shouldHide = !autoHidePrevented && manifest.autoHide
    lock.unlock()
    if shouldHide {
      hide(fade: false, durationMs: 0) {}
    }
  }

  @objc private func onJavaScriptDidFailToLoad() {
    Self.log.error("JavaScript failed to load; hiding the overlay")
    emit(.jsloadfailed)
    // The runtime that owned the listener is unusable now.
    eventListener = nil
    hide(fade: false, durationMs: 0) {}
  }

  /// A new JS runtime is starting (first load or dev reload). The stored
  /// listener belongs to the previous runtime; the new one registers its own.
  @objc private func onJavaScriptWillStartLoading() {
    eventListener = nil
  }

  @objc private func onReloadCommand() {
    // A dev reload starts a fresh JS runtime; re-present so the reload looks
    // like a launch instead of a frozen frame of the old UI.
    lock.lock()
    autoHidePrevented = false
    lock.unlock()
    // Drop the old runtime's listener before anything can be emitted.
    eventListener = nil
    show {}
  }

  // MARK: - Timers

  private func startFadeGuard() {
    fadeGuardActive = true
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.systemFadeGuard) { [self] in
      fadeGuardActive = false
      let queued = pendingHides
      pendingHides.removeAll()
      guard let overlay, overlayVisible else {
        queued.forEach { $0.completion() }
        return
      }
      guard let first = queued.first else { return }
      performHide(overlay, fade: first.fade, durationMs: first.durationMs) {
        queued.forEach { $0.completion() }
      }
    }
  }

  private func scheduleTimeout() {
    timeoutWork?.cancel()
    guard manifest.hideTimeoutMs > 0 else { return }
    let work = DispatchWorkItem { [self] in
      guard overlayVisible else { return }
      Self.log.error("overlay still visible after \(manifest.hideTimeoutMs, privacy: .public) ms; hiding it")
      emit(.timeout)
      hide(fade: true, durationMs: 200) {}
    }
    timeoutWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + manifest.hideTimeoutMs / 1000, execute: work)
  }

  // MARK: - Helpers

  private func emit(_ type: SplashNativeEventType) {
    eventListener?(SplashNativeEvent(type: type, timestampMs: Date().timeIntervalSince1970 * 1000))
  }

  private static var isRunningInAppExtension: Bool {
    Bundle.main.bundlePath.hasSuffix(".appex")
  }

  private static func keyWindow() -> UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let windows = scenes.flatMap { $0.windows }
    return windows.first { $0.isKeyWindow } ?? windows.first ?? UIApplication.shared.delegate?.window ?? nil
  }

  private static func instantiateLaunchScreen() -> UIView? {
    let name = Bundle.main.object(forInfoDictionaryKey: "UILaunchStoryboardName") as? String ?? "SplashScreen"
    // Brownfield apps may not ship a storyboard at all.
    guard Bundle.main.path(forResource: name, ofType: "storyboardc") != nil else { return nil }
    guard let controller = UIStoryboard(name: name, bundle: nil).instantiateInitialViewController() else { return nil }
    return controller.view
  }

  /// Breadth-first search for RN's hosting root view. Matched by behaviour
  /// (the two selectors the attach needs) rather than by class name so
  /// subclasses and future renames keep working.
  private static func findHostRootView(in root: UIView) -> UIView? {
    var queue: [UIView] = [root]
    let disable = NSSelectorFromString("disableActivityIndicatorAutoHide:")
    let loading = NSSelectorFromString("setLoadingView:")
    while !queue.isEmpty {
      let view = queue.removeFirst()
      if view.responds(to: disable), view.responds(to: loading) { return view }
      queue.append(contentsOf: view.subviews)
    }
    return nil
  }

  private static func callBoolSetter(_ target: NSObject, selector: Selector, value: Bool) {
    guard let imp = target.method(for: selector) else { return }
    typealias Setter = @convention(c) (AnyObject, Selector, Bool) -> Void
    unsafeBitCast(imp, to: Setter.self)(target, selector, value)
  }
}
