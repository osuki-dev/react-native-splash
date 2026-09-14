package com.margelo.nitro.splash

import android.content.Context
import android.graphics.Color
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageView
import kotlin.math.min

/**
 * The library's own copy of the launch screen, on the decor view so it also
 * covers the system bars in edge-to-edge apps.
 *
 * Two shapes:
 * - the Android 12 launch screen drawn from the same theme attributes: solid
 *   background, icon centred on a 288 dp canvas;
 * - the app-supplied launch image: the pack's paper with the picture centred
 *   in a box sized by the rule the JS mirror uses, so the handoff stays
 *   pixel-identical.
 */
class SplashOverlayView private constructor(
  context: Context,
  /** The colour behind the picture; also becomes the window background. */
  val paperColor: Int,
) : FrameLayout(context) {
  private var launchImage: SplashLaunchImageSpec? = null
  private var image: ImageView? = null

  /** The theme's own launch screen. */
  constructor(context: Context, attrs: SplashThemeAttributes, logoSizeRatio: Float) : this(context, attrs.backgroundColor) {
    val icon = attrs.icon ?: return
    val size = dp(ICON_CANVAS_DP * logoSizeRatio)
    image = ImageView(context).apply {
      setImageDrawable(icon)
      scaleType = ImageView.ScaleType.FIT_CENTER
      addView(this, LayoutParams(size, size, Gravity.CENTER))
    }
  }

  /** The app-supplied launch image. */
  constructor(context: Context, launchImage: SplashLaunchImageSpec, night: Boolean) : this(
    context,
    parseColor(if (night) launchImage.darkBackgroundColor ?: launchImage.backgroundColor else launchImage.backgroundColor),
  ) {
    this.launchImage = launchImage
    val targetWidth = min(
      context.resources.displayMetrics.widthPixels * launchImage.widthFraction,
      dp(launchImage.maxWidth.toFloat()).toDouble(),
    ).toInt()
    val bitmap = SplashLaunchImageStore.decode(launchImage, targetWidth) ?: return
    image = ImageView(context).apply {
      setImageBitmap(bitmap)
      scaleType = ImageView.ScaleType.FIT_CENTER
      addView(this, LayoutParams(0, 0, Gravity.CENTER))
    }
  }

  init {
    setBackgroundColor(paperColor)
    isClickable = true
    isFocusable = false
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val spec = launchImage
    val view = image
    if (spec != null && view != null) {
      // `min(width * fraction, maxWidth)` wide, `aspectRatio` tall. Mirrored in `use-splash-mirror.ts`.
      val widthPx = min(MeasureSpec.getSize(widthMeasureSpec) * spec.widthFraction, dp(spec.maxWidth.toFloat()).toDouble())
      val ratio = if (spec.aspectRatio > 0) spec.aspectRatio else 1.0
      val params = view.layoutParams as LayoutParams
      params.width = widthPx.toInt()
      params.height = (widthPx / ratio).toInt()
    }
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }

  private fun dp(value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

  companion object {
    /** Android 12 icon slot without an icon background. */
    const val ICON_CANVAS_DP = 288f

    private fun parseColor(hex: String): Int = runCatching { Color.parseColor(hex) }.getOrDefault(Color.WHITE)
  }
}
