# Hosting

Gorilla To Go is hosted with GitHub Pages at https://gorillatogo.app (decision 18). It moved from gtg.exhibita.com on 2026-10-18.

The repository `exhibita/gorilla-to-go` is public. GitHub Pages is free for a public repository.

## How the deploy works

The workflow `.github/workflows/pages.yml` runs on each push to `main`. You can also start it by hand on the **Actions** tab.

1. The `test` job runs `npm test`.
2. If the tests pass, the `deploy` job publishes the `app/` folder. It does not publish other folders.

The custom domain is a setting in **Settings > Pages**. GitHub ignores the file `app/CNAME` when a workflow deploys the site. The file only records the domain in the repository.

## Set up the domain

Do these steps one time. You need access to the DNS settings for `gorillatogo.app`, and you must sign in to GitHub as `exhibita`.

`gorillatogo.app` is an apex domain (it has no subdomain part), so it uses A records, not a CNAME record.

### 1. Verify the domain (recommended)

A verified domain stops other GitHub users from taking over `gorillatogo.app`.

1. On github.com, tap your profile picture.
2. Tap **Settings**.
3. Tap **Pages**.
4. Tap **Add a domain**.
5. Type `gorillatogo.app`.
6. Tap **Add domain**. GitHub shows a TXT record.
7. At your DNS provider, add the TXT record that GitHub shows. The name starts with `_github-pages-challenge-exhibita`.
8. Wait for the DNS change. This can take some minutes.
9. On GitHub, tap **Verify**.

### 2. Add the DNS records

1. At your DNS provider, add four records with **Type** `A` and **Name** (or **Host**) `@`. Give each record one of these values:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
2. Optional: for IPv6, add four records with **Type** `AAAA` and **Name** `@`:
   - `2606:50c0:8000::153`
   - `2606:50c0:8001::153`
   - `2606:50c0:8002::153`
   - `2606:50c0:8003::153`
3. Add a record with **Type** `CNAME`, **Name** `www` and **Target** `exhibita.github.io`. GitHub then sends www.gorillatogo.app to gorillatogo.app.
4. Keep the default TTL.
5. Save the records.

To check the records, run this command on a computer:

```
nslookup gorillatogo.app
```

The result must show the four `185.199.` addresses.

### 3. Turn on GitHub Pages

1. Open https://github.com/exhibita/gorilla-to-go/settings/pages.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

   Do not select **Deploy from a branch**. With that setting, GitHub publishes the full repository with Jekyll. The address then shows the README, not the app.
3. Under **Custom domain**, type `gorillatogo.app`.
4. Tap **Save**.
5. Wait until GitHub shows **DNS check successful**.

### 4. Turn on HTTPS

1. Stay on the same page.
2. Select **Enforce HTTPS**.

If **Enforce HTTPS** is not available, GitHub has not issued the certificate yet. This can take up to 24 hours. Come back later and select it.

### 5. Check the site

1. Merge a change into `main`, or start the workflow by hand on the **Actions** tab.
2. Wait until the workflow run is green.
3. Open https://gorillatogo.app on your phone.
4. Make sure that the Welcome screen opens.

## The old address

The app was at https://gtg.exhibita.com until 2026-10-18. That address now gives "404 Not Found". The browser keeps the data of each address apart. An app that was installed from the old address does not move to the new address: install the app again from https://gorillatogo.app, and add the sites again.
