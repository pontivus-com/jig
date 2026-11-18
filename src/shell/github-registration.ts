import type { GitHubAppRegistration } from "./github-auth";

/**
 * Public GitHub App registration material.
 *
 * v1.1 intentionally keeps this unavailable until the real Jig GitHub App is
 * registered with the governed permission/callback configuration. One public
 * Jig GitHub App owns both exact callbacks:
 * - Linux: http://127.0.0.1:47832/setup/github/callback
 * - Android: com.pontivus.jig://oauth/github
 *
 * Every web-flow authorization request selects one callback explicitly through
 * redirect_uri. Do not enable GitHub's "Request user authorization (OAuth)
 * during installation" setting, because that install-time flow selects the
 * first callback rather than Jig's current platform callback.
 *
 * Do not place placeholder credentials here. The client secret is public
 * registration material once the app exists; the GitHub App private key is
 * never shipped.
 */
export const GITHUB_APP_REGISTRATION: GitHubAppRegistration | null = null;
