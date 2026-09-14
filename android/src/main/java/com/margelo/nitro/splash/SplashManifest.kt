package com.margelo.nitro.splash

import android.app.Activity
import android.content.Context
import android.content.res.Configuration
import android.os.Build

/**
 * Builds the manifest JS uses to mirror the launch screen: theme colours,
 * the icon resource and device quirks. Sizes are in dp.
 */
object SplashManifest {
  private const val LOGO_RESOURCE = "splashscreen_logo"
  private const val BACKGROUND_RESOURCE = "splashscreen_background"

  fun load(application: Context?, activity: Activity?, attrs: SplashThemeAttributes?): SplashManifestSpec {
    val context = activity ?: application
    val resources = context?.resources
    val packageName = context?.packageName ?: ""

    val backgroundColor = attrs?.backgroundColor ?: resolveColor(context, BACKGROUND_RESOURCE, night = false)
    val darkBackgroundColor = resolveColor(context, BACKGROUND_RESOURCE, night = true)

    val logoName = when {
      attrs != null && attrs.iconResId != 0 -> resources?.getResourceEntryName(attrs.iconResId)
      resources?.getIdentifier(LOGO_RESOURCE, "drawable", packageName).let { it != null && it != 0 } -> LOGO_RESOURCE
      else -> null
    }
    val logo = logoName?.let { SplashLogoSpec(it, SplashOverlayView.ICON_CANVAS_DP.toDouble(), SplashOverlayView.ICON_CANVAS_DP.toDouble()) }

    return SplashManifestSpec(
      backgroundColor = hex(backgroundColor ?: 0xFFFFFFFF.toInt()),
      darkBackgroundColor = darkBackgroundColor?.let { hex(it) },
      logo = logo,
      // The night drawable qualifier resolves automatically under the same name.
      darkLogo = logo,
      logoSizeRatio = logoSizeRatio(),
      statusBarHeight = systemBarHeightDp(context, "status_bar_height"),
      navigationBarHeight = systemBarHeightDp(context, "navigation_bar_height"),
      edgeToEdge = isEdgeToEdge(context),
      autoHide = boolResource(context, "osuki_splash_auto_hide", default = true),
      hideTimeoutMs = integerResource(context, "osuki_splash_hide_timeout_ms", default = 15_000).toDouble(),
    )
  }

  fun isNight(context: Context?): Boolean {
    val mode = context?.resources?.configuration?.uiMode ?: return false
    return (mode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
  }

  /**
   * Samsung One UI 4+ draws the Android 12 launch icon at half size.
   * https://github.com/zoontek/react-native-bootsplash/issues/466
   */
  private fun logoSizeRatio(): Double {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return 1.0
    if (!Build.MANUFACTURER.equals("samsung", ignoreCase = true)) return 1.0
    val semPlatformInt = runCatching {
      Build.VERSION::class.java.getDeclaredField("SEM_PLATFORM_INT").getInt(null)
    }.getOrNull() ?: return 1.0
    return if (semPlatformInt >= 130_000) 0.5 else 1.0
  }

  private fun resolveColor(context: Context?, name: String, night: Boolean): Int? {
    context ?: return null
    val id = context.resources.getIdentifier(name, "color", context.packageName)
    if (id == 0) return null
    val configuration = Configuration(context.resources.configuration).apply {
      uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
        (if (night) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO)
    }
    val themed = context.createConfigurationContext(configuration)
    return runCatching { themed.getColor(id) }.getOrNull()
  }

  private fun systemBarHeightDp(context: Context?, name: String): Double {
    context ?: return 0.0
    val id = context.resources.getIdentifier(name, "dimen", "android")
    if (id == 0) return 0.0
    val px = context.resources.getDimensionPixelSize(id)
    return px / context.resources.displayMetrics.density.toDouble()
  }

  /**
   * Edge-to-edge is enforced for apps targeting 35 on Android 15+, and React
   * Native 0.81+ opts in by default below that. Report the enforced case;
   * the JS mirror only uses bar insets when this is false.
   */
  private fun isEdgeToEdge(context: Context?): Boolean {
    context ?: return true
    val targetSdk = context.applicationInfo.targetSdkVersion
    return Build.VERSION.SDK_INT >= 35 && targetSdk >= 35
  }

  private fun boolResource(context: Context?, name: String, default: Boolean): Boolean {
    context ?: return default
    val id = context.resources.getIdentifier(name, "bool", context.packageName)
    return if (id == 0) default else context.resources.getBoolean(id)
  }

  private fun integerResource(context: Context?, name: String, default: Int): Int {
    context ?: return default
    val id = context.resources.getIdentifier(name, "integer", context.packageName)
    return if (id == 0) default else context.resources.getInteger(id)
  }

  private fun hex(color: Int): String = String.format("#%06X", color and 0xFFFFFF)
}
