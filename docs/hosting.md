# Hosting

Gorilla To Go is hosted with GitHub Pages at https://gtg.exhibita.com (decision 18).

The repository `exhibita/gorilla-to-go` is public. GitHub Pages is free for a public repository.

## How the deploy works

The workflow `.github/workflows/pages.yml` runs on each push to `main`. You can also start it by hand on the **Actions** tab.

1. The `test` job runs `npm test`.
2. If the tests pass, the `deploy` job publishes the `app/` folder. It does not publish other folders.

The custom domain is a setting in **Settings > Pages**. GitHub ignores the file `app/CNAME` when a workflow deploys the site. The file only records the domain in the repository.

## Set up the domain

Do these steps one time. You need access to the DNS settings for `exhibita.com`, and you must sign in to GitHub as `exhibita`.

### 1. Verify the domain (recommended)

A verified domain stops other GitHub users from taking over `gtg.exhibita.com`.

1. On github.com, tap your profile picture.
2. Tap **Settings**.
3. Tap **Pages**.
4. Tap **Add a domain**.
5. Type `exhibita.com`.
6. Tap **Add domain**. GitHub shows a TXT record.
7. At your DNS provider, add the TXT record that GitHub shows. The name starts with `_github-pages-challenge-exhibita`.
8. Wait for the DNS change. This can take some minutes.
9. On GitHub, tap **Verify**.

### 2. Add the DNS record

1. At your DNS provider, add a new record.
2. Set **Type** to `CNAME`.
3. Set **Name** (or **Host**) to `gtg`.
4. Set **Target** (or **Value**) to `exhibita.github.io`. Do not add the repository name.
5. Keep the default TTL.
6. Save the record.

To check the record, run this command on a computer:

```
nslookup gtg.exhibita.com
```

The result must show `exhibita.github.io`.

### 3. Turn on GitHub Pages

1. Open https://github.com/exhibita/gorilla-to-go/settings/pages.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

   Do not select **Deploy from a branch**. With that setting, GitHub publishes the full repository with Jekyll. The address then shows the README, not the app.
3. Under **Custom domain**, type `gtg.exhibita.com`.
4. Tap **Save**.
5. Wait until GitHub shows **DNS check successful**.

### 4. Turn on HTTPS

1. Stay on the same page.
2. Select **Enforce HTTPS**.

If **Enforce HTTPS** is not available, GitHub has not issued the certificate yet. This can take up to 24 hours. Come back later and select it.

### 5. Check the site

1. Merge a change into `main`, or start the workflow by hand on the **Actions** tab.
2. Wait until the workflow run is green.
3. Open https://gtg.exhibita.com on your phone.
4. Make sure that the Welcome screen opens.
