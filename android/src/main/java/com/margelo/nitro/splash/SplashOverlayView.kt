package com.margelo.nitro.splash

import android.content.Context
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageView

/**
 * A copy of the Android 12 launch screen drawn from the same theme
 * attributes: solid background, icon centred on a 288 dp canvas. Lives on
 * the decor view, so it also covers the system bars in edge-to-edge apps.
 */
class SplashOverlayView(
  context: Context,
  attrs: SplashThemeAttributes,
  logoSizeRatio: Float,
) : FrameLayout(context) {
  init {
    setBackgroundColor(attrs.backgroundColor)
    isClickable = true
    isFocusable = false
    val icon = attrs.icon
    if (icon != null) {
      val size = dp(ICON_CANVAS_DP * logoSizeRatio)
      val image = ImageView(context).apply {
        setImageDrawable(icon)
        scaleType = ImageView.ScaleType.FIT_CENTER
      }
      addView(image, LayoutParams(size, size, Gravity.CENTER))
    }
  }

  private fun dp(value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

  companion object {
    /** Android 12 icon slot without an icon background. */
    const val ICON_CANVAS_DP = 288f
  }
}
