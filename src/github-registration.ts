import type { GitHubAppRegistration } from "./github";

/**
 * Public GitHub App registration material.
 *
 * v1.1 uses one governed GitHub App registration for Desktop and Android:
 * "Jig Desktop & Mobile". Both clients authorize directly with GitHub through
 * Device Flow. Device Flow requires only the GitHub App client_id; it does not
 * use client_secret or redirect_uri. The app_slug is public routing metadata
 * used only for the GitHub installation page.
 *
 * No GitHub App client_secret or private key may be committed to, shipped
 * with, logged by, or read by Jig.
 */
export const GITHUB_APP_REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop-mobile",
  client_id: "Iv23liyCoLFStLGRXgUk",
};
