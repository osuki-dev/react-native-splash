package com.margelo.nitro.splash

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.File
import org.json.JSONObject

/**
 * The app-supplied launch picture, persisted in SharedPreferences so it is
 * there before JavaScript is: the manager reads it while attaching the
 * overlay, in `onActivityCreated`.
 */
object SplashLaunchImageStore {
  private const val PREFS = "dev.osuki.splash"
  private const val KEY = "launchImage"

  fun load(context: Context): SplashLaunchImageSpec? {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return null
    return runCatching {
      val json = JSONObject(raw)
      val uri = json.getString("uri")
      if (!File(path(uri)).exists()) return null
      SplashLaunchImageSpec(
        uri = uri,
        backgroundColor = json.getString("backgroundColor"),
        darkBackgroundColor = if (json.has("darkBackgroundColor")) json.getString("darkBackgroundColor") else null,
        widthFraction = json.getDouble("widthFraction"),
        maxWidth = json.getDouble("maxWidth"),
        aspectRatio = json.getDouble("aspectRatio"),
      )
    }.getOrNull()
  }

  fun save(context: Context, image: SplashLaunchImageSpec) {
    val json = JSONObject()
      .put("uri", image.uri)
      .put("backgroundColor", image.backgroundColor)
      .put("widthFraction", image.widthFraction)
      .put("maxWidth", image.maxWidth)
      .put("aspectRatio", image.aspectRatio)
    image.darkBackgroundColor?.let { json.put("darkBackgroundColor", it) }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json.toString()).apply()
  }

  fun clear(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
  }

  fun path(uri: String): String {
    val parsed = Uri.parse(uri)
    return if (parsed.scheme == "file") parsed.path ?: uri else uri
  }

  /**
   * Decode at roughly the size it will be drawn: a theme's picture can be a
   * few thousand pixels wide and this runs on the main thread before the
   * first frame.
   */
  fun decode(image: SplashLaunchImageSpec, targetWidthPx: Int): Bitmap? {
    val file = path(image.uri)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file, bounds)
    if (bounds.outWidth <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= targetWidthPx) sample *= 2
    val options = BitmapFactory.Options().apply { inSampleSize = sample }
    return BitmapFactory.decodeFile(file, options)
  }
}
