// Sign-in module. All token handling is in this file, so GitHub sign-in (OAuth) can replace
// personal access tokens later without changes elsewhere (CLAUDE.md, decision 5).
// Rules: never log a token, never put it in a URL.

// The value of the Authorization header for GitHub API requests.
export function authorizationHeader(token) {
    return `Bearer ${token}`;
}
