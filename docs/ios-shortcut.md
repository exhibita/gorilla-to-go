# Build the iPhone Shortcut "Send to Gorilla To Go"

This document is for the site owner. It tells you how to build the Shortcut on an iPhone, one action at a time. You do not need to use an iPhone every day.

The Shortcut sends photos from the iPhone share sheet to the branch `gtg-inbox` of a site repository. Then Gorilla To Go (GTG) adds the photos to a gallery. The in-app help page (`#/help/shortcut`, from `app/js/screens/help-shortcut.js`) tells other people how to add the Shortcut.

## Warning: your photos stay in the site history

Read this before you build the Shortcut. Keep this text the same as the warning on the help page.

- Each photo that the Shortcut sends goes into the history of the site repository. The photo stays in the history, also after you delete the photo or the inbox.
- A photo can contain its location (GPS data) and other data. An iPhone photo is often a HEIC file.
- When the site repository is public, anyone can see the history on github.com.

When the repository is public, do one of these:

- Remove the location before you send. In Photos, tap Share. Tap **Options** at the top. Turn off **Location**. Do not change the Convert Image step of the Shortcut (Preserve Metadata off).
- Do not use the Shortcut. In GTG, open the gallery and tap **Add photos**. You can select many photos at once. GTG removes the location and the other data before the upload.

## 1. Before you start

- Use an iPhone with iOS 17 or later.
- Sign in to the iPhone with your own Apple ID, if you can. The iCloud link of the Shortcut belongs to the Apple ID that makes it.
- Use the test site `exhibita/gtg-test-site`. Do not test on a real site.
- Make a fine-grained GitHub token for the test site. Set **Contents** to **Read and write**. The in-app page "How to create a GitHub token" has the steps.
- Put the token where you can copy it on the iPhone, for example in a password manager.

Note: The names of some actions and settings can be different in your version of iOS. When a name does not match, look for the action or setting that does the same job.

## 2. Build the Shortcut

Open the Shortcuts app. Tap **+** to make a new Shortcut.

### 2.1 Settings of the Shortcut

1. Tap the name of the Shortcut at the top. Tap **Rename**.
2. Type `Send to Gorilla To Go`. Tap **Done**.
3. Open the Shortcut details (the **i** button).
4. Turn on **Show in Share Sheet**.
5. In the first action, **Receive Input from Share Sheet**, tap the list of types.
6. Turn off all types, and leave **Images** on. The action must say **Receive Images input from Share Sheet**.

### 2.2 The site list

1. Add the action **Dictionary**.
2. Tap **Add new item**. Select **Dictionary** as the type of the item.
3. Type the site name as the key, for example `gtg-test-site`. This name appears in the list "Which site?".
4. In the value, add the items below. Select **Text** as the type of each item. Use these keys exactly:
    - `owner`: for example `exhibita`
    - `repo`: for example `gtg-test-site`
    - `branch`: the branch that the site is built from, for example `main`
    - `token`: the GitHub token of the site
5. To add more sites, add one more item with a dictionary value for each site.
6. Add the action **Set Variable** after the Dictionary action. Name the variable `Sites`.

### 2.3 Choose the site

1. Add the action **Get Dictionary Value**.
2. In the action, tap **Value** and select **All Keys**. Set the dictionary to the variable `Sites`.
3. Add the action **Choose from List**.
4. Set the prompt of the list to `Which site?`. The list must be the result of the action before it.
5. Add the action **Get Dictionary Value**.
6. Keep **Value** selected. Set the key to the **Chosen Item**. Set the dictionary to the variable `Sites`.
7. Add the action **Set Variable**. Name the variable `Site`.
8. Add the action **Get Dictionary Value** with the key `owner` and the dictionary `Site`. Add the action **Set Variable** after it. Name the variable `Owner`.
9. Do the same for `repo` (variable `Repo`), `branch` (variable `Branch`) and `token` (variable `Token`).

### 2.4 Find or make the branch `gtg-inbox`

Use the same two headers in each **Get Contents of URL** action in this document:

- `Authorization`: the text `Bearer ` (with a space at the end), then the variable `Token`
- `Accept`: `application/vnd.github+json`

To add headers, tap **Show More** in the action. Tap **Add new header**.

1. Add the action **Get Contents of URL**.
2. Set the URL to `https://api.github.com/repos/` then `Owner`, `/`, `Repo`, `/git/ref/heads/gtg-inbox`.
3. Tap **Show More**. Set **Method** to **GET**.
4. Add the two headers.
5. Add the action **Get Dictionary Value**. Set the key to `object` and the dictionary to **Contents of URL**.
6. Add the action **If**. Set the input to the result of step 5. Set the condition to **does not have any value**.
7. Inside the **If**, add the action **Get Contents of URL**. Set the URL to `https://api.github.com/repos/` then `Owner`, `/`, `Repo`, `/git/ref/heads/`, `Branch`.
8. Set **Method** to **GET**. Add the two headers.
9. Add the action **Get Dictionary Value**. Set the key to `object` and the dictionary to **Contents of URL**.
10. Add the action **Get Dictionary Value** again. Set the key to `sha` and the dictionary to the result of step 9.
11. Add the action **Set Variable**. Name the variable `BranchSha`.
12. Add the action **Get Contents of URL**. Set the URL to `https://api.github.com/repos/` then `Owner`, `/`, `Repo`, `/git/refs`.
13. Set **Method** to **POST**. Add the two headers.
14. Set **Request Body** to **JSON**. Add two **Text** fields:
    - `ref`: `refs/heads/gtg-inbox`
    - `sha`: the variable `BranchSha`
15. Look at the end of the **If** block. Make sure the block ends with **End If**.

### 2.5 Send each photo

1. Add the action **Repeat with Each**. Set the input to **Shortcut Input**.
2. Inside the loop, add the action **Convert Image**. Set the input to **Repeat Item**.
3. Set the format to **JPEG**.
4. Tap **Show More**. Set the quality to about 0.8. (The quality can show as a slider or as a word, for example **Medium**. Use a value near 0.8.)
5. Turn **Preserve Metadata** off. This step is required. It removes the location and the other data. Do not change it.
6. Add the action **Set Variable**. Name the variable `Photo`.
7. Add the action **Get Details of Images**. Set the input to `Photo`. Select **Width**.
8. Add the action **If**. Set the input to the width. Set the condition to **is greater than**. Set the number to `1600`.
9. Inside the **If**, add the action **Resize Image**. Set the input to `Photo`.
10. Set the width to `1600`. Set the height to **Auto**. (Tap **Show More** if you do not see the height.)
11. Add the action **Set Variable**. Name the variable `Photo`.
12. Look at the end of the **If** block. Make sure the block ends with **End If**.
13. Add the action **Base64 Encode**. Set the input to `Photo`. Set the mode to **Encode**. Tap the arrow of the action, and set **Line Breaks** to **None**.
14. Add the action **Set Variable**. Name the variable `Encoded`.
15. Add the action **Current Date**.
16. Add the action **Format Date**. Set the date format to **Custom**. Type the format `yyyy-MM-dd-HHmmss`.
17. Add the action **Set Variable**. Name the variable `Stamp`.
18. Add the action **Random Number**. Set the minimum to `1000` and the maximum to `9999`.
19. Add the action **Set Variable**. Name the variable `Random`.
20. Add the action **Get Contents of URL**. Set the URL to `https://api.github.com/repos/` then `Owner`, `/`, `Repo`, `/contents/gtg-inbox/`, `Stamp`, `-`, `Random`, `-`, `Repeat Index`, `.jpg`.
21. Set **Method** to **PUT**. Add the two headers.
22. Set **Request Body** to **JSON**. Add three **Text** fields:
    - `message`: `Photo for the gallery inbox`
    - `content`: the variable `Encoded`
    - `branch`: `gtg-inbox`
23. Look at the end of the **Repeat** block. Make sure the block ends with **End Repeat**.

### 2.6 Tell the user

1. After **End Repeat**, add the action **Count**. Set the input to **Shortcut Input**. Select **Items**.
2. Add the action **Show Notification**.
3. Type this text. Use the **Count** result for N. Use the **Chosen Item** for the site name:
   `N photos sent to <site>. Open Gorilla To Go to add them to a gallery.`

## 3. Test on the test site

1. In the Photos app, select 1 photo. Tap Share. Tap **Send to Gorilla To Go**.
2. Select the test site.
3. Wait for the notification. The notification can say that photos were sent, also when a step failed. Check GitHub in the next steps.
4. On github.com, open the repository `exhibita/gtg-test-site`. Open the branch `gtg-inbox`. Open the folder `gtg-inbox`.
5. Make sure the file is there. Make sure the name ends with `.jpg`.
6. Make sure the width of the photo is at most 1600 px.
7. Download one file. Open it in a tool that shows EXIF data. Make sure it has no location data.
8. Share 5 photos at the same time. Include one large photo. Do steps 4 to 7 again.
9. Open Gorilla To Go. Open the test site. Tap the row that shows how many photos are waiting.
10. Tap **Add to a gallery**. Make sure the photos are in the gallery.

If a step fails, run the Shortcut again and look at the result of each **Get Contents of URL** action. A result with `message` means that GitHub refused the request. Check the token, the owner and the repository name.

## 4. Remove your token before you share

The iCloud link copies everything in the Shortcut, with your token. Do these steps before you make the link.

1. Open the Dictionary action. Set each `token` value to empty.
2. Open the Shortcut details (the **i** button).
3. Look for **Import Questions**. In some versions of iOS, it is on the **Setup** tab.
4. Add one question for each site. Select the `token` value of that site. Use the text `Paste the GitHub token for <site>`.
5. Add questions for the other values of the site list (`owner`, `repo`, `branch`), if other people use other sites.
6. If the list of Import Questions does not show a `token` value, make a **Text** action for each token above the Dictionary action. Use the **Text** result in the Dictionary. Ask the question for the **Text** action.
7. Look at the Dictionary action again. Make sure no token is in it.

## 5. Make the iCloud link

1. In the Shortcuts app, find the Shortcut. Open the menu of the Shortcut and tap Share.
2. Tap **Copy iCloud Link**.
3. Open the link on an iPhone that does not have the Shortcut, if you can. Make sure that the Shortcut asks the questions and that it contains no token.
4. Send the link to the developer. The developer puts it in `SHORTCUT_LINK` in `app/js/screens/help-shortcut.js`.
5. Put your own token in the Shortcut again, if you want to use it.
6. Delete the token of the test site on GitHub, when you do not need it.

## 6. If the link stops working

The iCloud link belongs to the Apple ID that made it. When that Apple ID deletes the Shortcut, the link stops working. Then do this:

1. Build the Shortcut again from this document.
2. Make a new iCloud link (section 5).
3. Send the new link to the developer.
