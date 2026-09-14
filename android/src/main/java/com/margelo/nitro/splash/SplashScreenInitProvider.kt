package com.margelo.nitro.splash

import android.app.Application
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

/**
 * Runs before `Application.onCreate` (content providers are created first),
 * which is early enough to see the launcher activity's `onActivityPreCreated`.
 * Declared in this library's manifest; the manifest merger adds it to the app.
 */
class SplashScreenInitProvider : ContentProvider() {
  override fun onCreate(): Boolean {
    val app = context?.applicationContext as? Application ?: return false
    SplashScreenManager.install(app)
    return true
  }

  override fun query(uri: Uri, projection: Array<String>?, selection: String?, selectionArgs: Array<String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int = 0
}
