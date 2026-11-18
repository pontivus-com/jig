import type { GitHubAppRegistration } from "./github-auth";

/**
 * Public GitHub App registration material.
 *
 * v1.1 intentionally keeps this unavailable until the real Jig GitHub App is
 * registered with the governed permission/callback configuration. Do not place
 * placeholder credentials here. The client secret is public registration
 * material once the app exists; the GitHub App private key is never shipped.
 */
export const GITHUB_APP_REGISTRATION: GitHubAppRegistration | null = null;
