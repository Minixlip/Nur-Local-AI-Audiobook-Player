import { notarize } from '@electron/notarize'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export default async function notarizeApp(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  if (!fs.existsSync(appPath)) {
    console.warn(`[notarize] Skipping notarization because the app bundle was not found: ${appPath}`)
    return
  }

  const keychainProfile = process.env.APPLE_NOTARY_KEYCHAIN_PROFILE
  if (keychainProfile) {
    console.log(`[notarize] Submitting ${appName}.app with keychain profile ${keychainProfile}`)
    await notarize({
      tool: 'notarytool',
      appPath,
      keychainProfile
    })
    return
  }

  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      '[notarize] Skipping notarization because APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID is missing.'
    )
    return
  }

  console.log(`[notarize] Submitting ${appName}.app for notarization`)
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId,
    appleIdPassword,
    teamId
  })
}
