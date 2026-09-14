package com.margelo.nitro.splash

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Loads libOsukiSplash.so so Nitro can register the HybridObject. There are
 * no classic native modules in this package.
 */
class OsukiSplashPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { HashMap() }

  companion object {
    init {
      OsukiSplashOnLoad.initializeNative()
    }
  }
}
