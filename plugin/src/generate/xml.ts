/**
 * Minimal text-level edits for Android resource files the app also owns
 * (`colors.xml`, `styles.xml`, `AndroidManifest.xml`). Used by the bare CLI;
 * the Expo plugin uses Expo's XML mods instead.
 */

const EMPTY_RESOURCES = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n'

export function ensureResourcesDocument(text: string | undefined): string {
  if (!text || !/<resources[\s>]/.test(text)) return EMPTY_RESOURCES
  return text
}

/** Replace `<color name="x">…</color>` or insert it before `</resources>`. */
export function upsertColor(text: string, name: string, value: string): string {
  const entry = `<color name="${name}">${value}</color>`
  const pattern = new RegExp(`[ \\t]*<color\\s+name="${escapeRegExp(name)}"[^>]*>[^<]*</color>[ \\t]*\\n?`)
  return upsert(ensureResourcesDocument(text), pattern, `  ${entry}\n`)
}

/** Replace the whole `<style name="x" …>…</style>` block or insert it. */
export function upsertStyle(text: string, name: string, parent: string, items: Array<{ name: string; value: string }>): string {
  const body = items.map((item) => `    <item name="${item.name}">${item.value}</item>`).join('\n')
  const entry = `  <style name="${name}" parent="${parent}">\n${body}\n  </style>\n`
  const pattern = new RegExp(`[ \\t]*<style\\s+name="${escapeRegExp(name)}"[^>]*>[\\s\\S]*?</style>[ \\t]*\\n?`)
  return upsert(ensureResourcesDocument(text), pattern, entry)
}

/** Set `android:theme` on the activity that carries the MAIN/LAUNCHER intent filter. */
export function setLauncherActivityTheme(manifest: string, theme: string): string {
  const activityPattern = /<activity\b[^>]*>[\s\S]*?<\/activity>/g
  let changed = false
  const result = manifest.replace(activityPattern, (block) => {
    if (changed || !/android\.intent\.category\.LAUNCHER/.test(block)) return block
    changed = true
    const openTag = block.match(/<activity\b[^>]*>/)?.[0] ?? ''
    const newOpenTag = /android:theme="[^"]*"/.test(openTag)
      ? openTag.replace(/android:theme="[^"]*"/, `android:theme="@style/${theme}"`)
      : openTag.replace(/<activity\b/, `<activity android:theme="@style/${theme}"`)
    return block.replace(openTag, newOpenTag)
  })
  if (!changed) {
    throw new Error('[react-native-splash] no launcher <activity> found in AndroidManifest.xml')
  }
  return result
}

function upsert(text: string, pattern: RegExp, entry: string): string {
  if (pattern.test(text)) return text.replace(pattern, entry)
  return text.replace(/<\/resources>/, `${entry}</resources>`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
