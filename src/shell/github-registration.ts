import type { GitHubAppRegistration } from "./github-auth";

/**
 * Public GitHub App registration material.
 *
 * v1.1 uses two independent GitHub Apps because desktop and Android have
 * different callback mechanisms. Each registration owns exactly one callback
 * and one public client registration. Do not mix client identifiers, secrets,
 * slugs, or callback URLs between platforms.
 *
 * Desktop GitHub App:
 * - name: Jig Desktop
 * - callback: http://127.0.0.1:47832/setup/github/callback
 * - Device Flow enabled only for loopback-bind fallback
 *
 * Android GitHub App:
 * - name: Jig Android
 * - callback: com.pontivus.jig://oauth/github
 * - Device Flow disabled
 *
 * The client secrets are public registration material in this open-source
 * client. GitHub App private keys are never shipped. Placeholder registration
 * values are forbidden.
 */
export const GITHUB_DESKTOP_APP_REGISTRATION:
  GitHubAppRegistration | null = null;

export const GITHUB_ANDROID_APP_REGISTRATION:
  GitHubAppRegistration | null = null;
