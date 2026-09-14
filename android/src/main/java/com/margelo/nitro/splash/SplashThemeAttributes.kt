package com.margelo.nitro.splash

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.Drawable
import androidx.core.splashscreen.R as SplashR

/**
 * What the activity's splash theme (`Theme.App.SplashScreen`, parent
 * `Theme.SplashScreen`) says, read before the theme is swapped.
 */
class SplashThemeAttributes(
  val backgroundColor: Int,
  val icon: Drawable?,
  val iconResId: Int,
  val postTheme: Int,
) {
  companion object {
    fun read(activity: Activity): SplashThemeAttributes {
      val attrs = intArrayOf(
        SplashR.attr.windowSplashScreenBackground,
        SplashR.attr.windowSplashScreenAnimatedIcon,
        SplashR.attr.postSplashScreenTheme,
      )
      val typed = activity.theme.obtainStyledAttributes(attrs)
      try {
        val background = typed.getColor(0, Color.WHITE)
        val iconResId = typed.getResourceId(1, 0)
        val icon = if (iconResId != 0) typed.getDrawable(1) else null
        val postTheme = typed.getResourceId(2, 0)
        return SplashThemeAttributes(background, icon, iconResId, postTheme)
      } finally {
        typed.recycle()
      }
    }
  }
}
