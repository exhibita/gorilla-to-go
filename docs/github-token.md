# Create a GitHub token for Gorilla To Go

Gorilla To Go needs a token to change your site on GitHub. A token is like a password that works for one site only.

You need one token for each site.

## Before you start

- You need a GitHub account.
- Your Vanilla Gorilla site must be in a GitHub repository.
- Use a computer or a phone browser. The GitHub mobile app cannot make tokens.

## Make the token

1. Sign in to github.com.
2. Tap your profile picture at the top right.
3. Tap **Settings**.
4. Scroll down and tap **Developer settings**.
5. Tap **Personal access tokens**.
6. Tap **Fine-grained tokens**.
7. Tap **Generate new token**.
8. In **Token name**, type a name, for example `Gorilla To Go – my-site`.
9. In **Expiration**, select how long the token works. When it expires, you must make a new token.
10. In **Resource owner**, select the account that owns the site.
11. In **Repository access**, select **Only select repositories**.
12. Select your site's repository.
13. Under **Permissions**, open **Repository permissions**.
14. Set **Contents** to **Read and write**.
15. Set **Actions** to **Read-only**.
16. Tap **Generate token**.
17. Tap the copy button next to the token.

GitHub shows the token only once. If you lose it, make a new token.

## Add the token to Gorilla To Go

1. Open Gorilla To Go.
2. Tap **Add a site**.
3. Tap **Paste** next to **Personal access token**.

The app checks the token automatically.

## Keep your token safe

- Do not share the token.
- Do not put the token in an email, a message or a file.
- Gorilla To Go keeps the token on your device only.
- If you think someone has your token, delete it on GitHub at once. Then make a new token.

## If something does not work

- **"Token not accepted":** copy the token again, and make sure you copied all of it.
- **"Repository not found":** make sure you selected the site's repository in step 12.
- **"No write access":** make sure **Contents** is set to **Read and write** in step 14.
- **The site belongs to an organization:** the organization owner may need to approve the token first.

Note: GitHub sometimes changes the names and places of these settings. If a step does not match, look for **Fine-grained tokens** in **Developer settings**.
