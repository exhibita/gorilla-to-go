# Design

Mockups (Design canvas): https://claude.ai/artifact/EPm7t3yWxTWaSKMN8udpEB

The canvas has four screens, each in light and dark: Welcome, Add a site, Pages and Editor.

## Light theme (vg.exhibita.com colors, from `src/css/style.css`)

| Use | Color |
|---|---|
| Background | `#f8f6f2` |
| Second background | `#f0ebe1` |
| Cards | `#ffffff` |
| Borders | `#e3dcd0` |
| Text | `#2b2927` |
| Muted text | `#66615c` |
| Primary | `#596e57` (hover `#455643`) |
| Secondary | `#c98263` |
| Accent | `#cca05a` |

## Dark theme

| Use | Color |
|---|---|
| Background | `#1c1a18` |
| Second background | `#242120` |
| Cards | `#2b2826` |
| Borders | `#3d3834` |
| Text | `#f0ebe1` |
| Muted text | `#a8a19a` |
| Primary | `#8fa88c` (hover `#a5bca2`) |
| Secondary | `#d9967a` |
| Accent | `#d9b273` |

Text on primary buttons is `#ffffff` in light and `#1c1a18` in dark. Test the contrast of all text before release.

## Page type labels

| Type | Light (background / text) | Dark (background / text) |
|---|---|---|
| Blog | `#e4ebe3` / `#3f513d` | `#2f3a2e` / `#b5c9b2` |
| Page | `#f5ead6` / `#7a5a22` | `#3d3324` / `#e6c78f` |
| Gallery | `#f5e1d8` / `#8a4a30` | `#3f2c24` / `#eab59c` |
| Links page | `#dfe8ef` / `#30506b` | `#253039` / `#a9c6de` |

The Links page colors have a contrast of 6.8:1 (light) and 7.6:1 (dark).

## Theme toggle

- Three settings: System, Light and Dark. The default is System.
- An icon button in the header. Each tap goes to the next setting.
- The choice is saved on the device.
- A small script in `<head>` applies the theme before the first paint.
- `theme-color` changes with the theme.

## Typography

- Outfit for the interface. Playfair Display for large titles only.
- Include the font files in the app. Do not load them from Google.
- Minimum text size in inputs and the editor: 16 px. Below 16 px, iPhone zooms in on focus.

## Layout

- Touch targets: 44 px minimum.
- "New page": a round sage button at the bottom right.
- Bottom sheets for frontmatter fields and confirmations.
- Editor: Write/Preview toggle, no side-by-side view. Toolbar above the keyboard: heading, bold, italic, link, list, image, undo.
- A gallery has a third view, Photos. A links page has a third view, Links: the picture (with its alt text) at the top, then one row per link with the button text and the address. A tap on a row opens a bottom sheet: button text, address, Move earlier, Move later, Remove. "Add link" is below the list.
- Details of a links page: no date. It adds the "Show in the sitemap" switch and the Page CSS field.

## Launch screen

The web app manifest controls the launch screen. Set `background_color` to `#f8f6f2` and use the VG logo as the app icon.
