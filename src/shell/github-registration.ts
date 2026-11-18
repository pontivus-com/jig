import type { GitHubAppRegistration } from "./github-auth";

/**
 * Public GitHub App registration material.
 *
 * v1.1 uses GitHub App Device Flow directly between each Jig client and
 * GitHub. Device Flow requires only the GitHub App client_id; it does not use
 * client_secret or redirect_uri. The app_slug is public routing metadata used
 * only for the GitHub installation page.
 *
 * No GitHub App client_secret or private key may be committed to, shipped
 * with, logged by, or read by Jig.
 */
export const GITHUB_DESKTOP_APP_REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop",
  client_id: "Iv23li8CqXS4x6hKPByI",
};

export const GITHUB_ANDROID_APP_REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-android",
  client_id: "Iv23liWxxIXGsQcBONup",
};
