package com.margelo.nitro.splash

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise

/** Nitro adapter over [SplashScreenManager]. Methods run on the JS thread. */
@DoNotStrip
@Keep
class HybridSplashScreen : HybridSplashScreenSpec() {
  override val manifest: SplashManifestSpec
    get() = SplashScreenManager.manifest

  override val launchInfo: SplashLaunchInfoSpec
    get() = SplashScreenManager.launchInfo()

  override fun isVisible(): Boolean = SplashScreenManager.isVisible

  override fun preventAutoHide() = SplashScreenManager.preventAutoHide()

  override fun hide(options: SplashHideOptionsSpec): Promise<Unit> {
    val promise = Promise<Unit>()
    SplashScreenManager.hide(options.fade, options.durationMs.toLong()) { promise.resolve(Unit) }
    return promise
  }

  override fun show(): Promise<Unit> {
    val promise = Promise<Unit>()
    SplashScreenManager.show { promise.resolve(Unit) }
    return promise
  }

  override fun setEventListener(listener: (event: SplashNativeEvent) -> Unit) {
    SplashScreenManager.eventListener = listener
  }

  override fun clearEventListener() {
    SplashScreenManager.eventListener = null
  }
}
