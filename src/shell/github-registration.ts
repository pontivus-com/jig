import type { GitHubAppRegistration } from "./github-auth";

/**
 * Public GitHub App registration material.
 *
 * v1.1 uses two independent GitHub Apps because desktop and Android have
 * different OAuth return mechanisms. Each registration owns exactly one
 * Redirect URI and one public client registration. Do not mix client
 * identifiers, secrets, slugs, or Redirect URIs between platforms.
 *
 * Desktop GitHub App:
 * - name: Jig Desktop
 * - Redirect URI: http://127.0.0.1:47832/setup/github/callback
 * - Device Flow enabled only for loopback-bind fallback
 *
 * Android GitHub App:
 * - name: Jig Android
 * - Redirect URI: com.pontivus.jig://oauth/github
 * - Device Flow disabled
 *
 * GitHub names the OAuth registration field `client_secret`; retain that
 * terminology exactly. For this open-source public/native client it is public
 * registration material, not a confidentiality or authorization boundary.
 * GitHub App private keys are never shipped. Placeholder registration values
 * are forbidden.
 */
export const GITHUB_DESKTOP_APP_REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop",
  client_id: "Iv23li8CqXS4x6hKPByI",
  client_secret: "01886f67e0b3368285c061b8fc688ffe7d94f382",
  redirect_uri: "http://127.0.0.1:47832/setup/github/callback",
};

export const GITHUB_ANDROID_APP_REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-android",
  client_id: "Iv23liWxxIXGsQcBONup",
  client_secret: "d6434745bd1a6f3e49251ee5fe5fa6756a52e0d8",
  redirect_uri: "com.pontivus.jig://oauth/github",
};
