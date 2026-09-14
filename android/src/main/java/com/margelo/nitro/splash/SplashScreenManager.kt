package com.margelo.nitro.splash

import android.app.Activity
import android.app.Application
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import android.util.Log
import android.view.ViewGroup
import android.window.SplashScreenView
import com.facebook.react.ReactActivity
import com.facebook.react.bridge.ReactMarker
import com.facebook.react.bridge.ReactMarkerConstants
import java.lang.ref.WeakReference

/**
 * Owns the native overlay for the whole process. Installed from
 * [SplashScreenInitProvider] before `Application.onCreate`, so apps need no
 * `MainActivity` changes.
 *
 * Strategy, per API level:
 * - 31+: the OS draws the launch screen from the manifest theme. In
 *   `onActivityPreCreated` (before RN calls `setContentView`) the activity is
 *   switched to `postSplashScreenTheme`; in `onActivityCreated` an identical
 *   [SplashOverlayView] is added to the decor view; the system splash is
 *   removed the moment its exit listener fires, revealing our copy.
 * - 29–30: same theme swap in `onActivityPreCreated`, overlay in
 *   `onActivityCreated`; the compat theme's `windowBackground` covers the gap.
 * - 24–28: no `onActivityPreCreated`; the theme swap is best-effort after
 *   `onCreate`. Apps that need the exact swap call [install] from
 *   `MainActivity.onCreate` before `super.onCreate`.
 */
object SplashScreenManager {
  private const val TAG = "OsukiSplash"

  @Volatile private var installed = false
  private var application: Application? = null
  private var activityRef: WeakReference<Activity>? = null
  private var overlay: SplashOverlayView? = null
  private var themeAttrs: SplashThemeAttributes? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var timeoutRunnable: Runnable? = null

  @Volatile private var overlayVisible = false
  @Volatile private var attachedAtMs = 0L
  @Volatile private var showCount = 0
  @Volatile private var contentAppearedCount = 0
  @Volatile private var systemSplashShown = false
  @Volatile private var autoHidePrevented = false

  @Volatile var eventListener: ((SplashNativeEvent) -> Unit)? = null

  /** The launch image in effect for this process; a change applies from the next cold start on. */
  private var launchImage: SplashLaunchImageSpec? = null

  @Volatile private var manifestCache: SplashManifestSpec? = null

  val manifest: SplashManifestSpec
    get() = manifestCache
      ?: SplashManifest.load(application, activityRef?.get(), themeAttrs, launchImage).also { manifestCache = it }

  fun setLaunchImage(image: SplashLaunchImageSpec) {
    application?.let { SplashLaunchImageStore.save(it, image) }
  }

  fun clearLaunchImage() {
    application?.let { SplashLaunchImageStore.clear(it) }
  }

  val isVisible: Boolean
    get() = overlayVisible

  private val processStartMs: Long =
    System.currentTimeMillis() - SystemClock.elapsedRealtime() + Process.getStartElapsedRealtime()

  private val contentAppearedListener = ReactMarker.MarkerListener { name, _, _ ->
    when (name) {
      ReactMarkerConstants.CONTENT_APPEARED -> {
        contentAppearedCount += 1
        if (!autoHidePrevented && manifest.autoHide) {
          hide(fade = false, durationMs = 0) {}
        }
      }
      // A dev reload tears the JS runtime down; the stored listener belongs
      // to it and the new runtime registers its own.
      ReactMarkerConstants.RELOAD -> {
        eventListener = null
        autoHidePrevented = false
      }
      else -> {}
    }
  }

  // ---------------------------------------------------------------------------
  // Installation
  // ---------------------------------------------------------------------------

  /** Called from the content provider. Idempotent. */
  fun install(app: Application) {
    if (installed) return
    installed = true
    application = app
    launchImage = SplashLaunchImageStore.load(app)
    ReactMarker.addListener(contentAppearedListener)
    app.registerActivityLifecycleCallbacks(lifecycleCallbacks)
  }

  /**
   * Explicit hook for `MainActivity.onCreate` (call before `super.onCreate`).
   * Only needed on API 24–28 where the automatic theme swap is best-effort.
   */
  @JvmStatic
  fun install(activity: Activity) {
    install(activity.application)
    prepare(activity)
  }

  private val lifecycleCallbacks = object : Application.ActivityLifecycleCallbacks {
    override fun onActivityPreCreated(activity: Activity, savedInstanceState: Bundle?) {
      if (activity is ReactActivity) prepare(activity)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
      if (activity !is ReactActivity) return
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) prepare(activity)
      attach(activity)
    }

    override fun onActivityStopped(activity: Activity) {
      // Exit listener firing after stop crashes SurfaceControl on API 31–33.
      // https://issuetracker.google.com/issues/242118185
      if (activity !is ReactActivity) return
      if (Build.VERSION.SDK_INT in Build.VERSION_CODES.S..Build.VERSION_CODES.TIRAMISU) {
        runCatching { activity.splashScreen.clearOnExitAnimationListener() }
      }
    }

    override fun onActivityDestroyed(activity: Activity) {
      if (activityRef?.get() === activity) {
        overlay = null
        overlayVisible = false
        activityRef = null
      }
    }

    override fun onActivityStarted(activity: Activity) {}
    override fun onActivityResumed(activity: Activity) {}
    override fun onActivityPaused(activity: Activity) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
  }

  /** Read the splash theme, swap to the post theme, arm the exit listener. Idempotent per activity. */
  private fun prepare(activity: Activity) {
    if (activityRef?.get() === activity && themeAttrs != null) return
    activityRef = WeakReference(activity)
    val attrs = SplashThemeAttributes.read(activity)
    themeAttrs = attrs
    manifestCache = null
    if (attrs.postTheme != 0) {
      activity.setTheme(attrs.postTheme)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      activity.splashScreen.setOnExitAnimationListener { view ->
        systemSplashShown = true
        // Our overlay is already underneath: drop the system view at once.
        // `SplashScreenView.remove()` skips applyThemesSystemBarAppearance.
        runCatching { (view as SplashScreenView).remove() }
      }
    } else {
      systemSplashShown = true
    }
  }

  // ---------------------------------------------------------------------------
  // Overlay
  // ---------------------------------------------------------------------------

  private fun attach(activity: Activity) {
    if (overlay != null) return
    val attrs = themeAttrs ?: SplashThemeAttributes.read(activity).also { themeAttrs = it }
    val decor = activity.window?.decorView as? ViewGroup ?: return
    val image = launchImage
    val night = SplashManifest.isNight(activity)
    val view = if (image != null) {
      Log.i(TAG, "drawing the app-supplied launch image")
      SplashOverlayView(activity, image, night)
    } else {
      SplashOverlayView(activity, attrs, manifest.logoSizeRatio.toFloat())
    }
    decor.addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    // A plain colour behind React content: no white frame, no leftover
    // compat icon on API < 31 once the overlay is gone.
    activity.window.setBackgroundDrawable(ColorDrawable(view.paperColor))

    overlay = view
    overlayVisible = true
    attachedAtMs = System.currentTimeMillis()
    showCount += 1
    scheduleTimeout()
    emit(SplashNativeEventType.ATTACHED)
  }

  fun hide(fade: Boolean, durationMs: Long, completion: () -> Unit) {
    mainHandler.post {
      val view = overlay
      if (!overlayVisible || view == null) {
        completion()
        return@post
      }
      overlayVisible = false
      overlay = null
      timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
      timeoutRunnable = null

      val remove = {
        (view.parent as? ViewGroup)?.removeView(view)
        emit(SplashNativeEventType.HIDDEN)
        completion()
      }
      if (fade && durationMs > 0) {
        view.animate().alpha(0f).setDuration(durationMs).withEndAction(remove).start()
      } else {
        remove()
      }
    }
  }

  fun show(completion: () -> Unit) {
    mainHandler.post {
      if (overlayVisible) {
        completion()
        return@post
      }
      val activity = activityRef?.get()
      if (activity == null || activity.isFinishing) {
        completion()
        return@post
      }
      attach(activity)
      emit(SplashNativeEventType.SHOWN)
      completion()
    }
  }

  fun preventAutoHide() {
    autoHidePrevented = true
  }

  fun launchInfo(): SplashLaunchInfoSpec {
    val night = SplashManifest.isNight(activityRef?.get() ?: application)
    return SplashLaunchInfoSpec(
      coldStart = showCount <= 1,
      reload = contentAppearedCount > 1,
      systemSplashShown = systemSplashShown,
      processStartMs = processStartMs.toDouble(),
      overlayAttachedMs = attachedAtMs.toDouble(),
      colorScheme = if (night) SplashColorScheme.DARK else SplashColorScheme.LIGHT,
    )
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private fun scheduleTimeout() {
    timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    val timeoutMs = manifest.hideTimeoutMs.toLong()
    if (timeoutMs <= 0) return
    val runnable = Runnable {
      if (!overlayVisible) return@Runnable
      Log.w(TAG, "overlay still visible after ${timeoutMs}ms; hiding it")
      emit(SplashNativeEventType.TIMEOUT)
      hide(fade = true, durationMs = 200) {}
    }
    timeoutRunnable = runnable
    mainHandler.postDelayed(runnable, timeoutMs)
  }

  private fun emit(type: SplashNativeEventType) {
    val listener = eventListener ?: return
    // Invoking a callback whose JS runtime is gone throws; that must never
    // take the main thread down.
    runCatching { listener(SplashNativeEvent(type, System.currentTimeMillis().toDouble())) }
      .onFailure { Log.w(TAG, "dropping $type: JS listener unavailable", it) }
  }
}
