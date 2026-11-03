# App Store Icon

Search app icons from the App Store, then insert them into a document or apply them as document icons in SiYuan.

## Features

- Top bar button, or `Alt + Shift + A` to open the search panel
- Powered by the Apple iTunes Search API, six storefronts: Mainland China, Hong Kong China, Taiwan China, United States, Japan, United Kingdom
- Works with Chinese and English keywords
- **Left click**: insert at the cursor of the current document
- **Right click**: menu with "Set as document icon" and "Download only"
- **Recently used**: the panel remembers your last icons for one-click reuse
- **Downloaded marker**: a blue dot appears on results whose icon already exists
- Icons are saved to `data/emojis/appstore/`, with values like `appstore/WeChat.png`

## Settings

- **Default storefront**: which App Store region is preselected
- **Rounded corners**: round the square artwork to 22% so it matches SiYuan's other icons; turn off to keep the original square artwork
- **Recent items**: 0–20, set 0 to disable

Settings are stored through SiYuan's plugin data API and sync along with `data/`.

The default hotkey is `Alt + Shift + A`. To change it, go to **Settings → Keymap** and search for "App Store Icon" — changes there take effect immediately and show conflicts.

## Usage

1. Click the magnifier in the top bar, or press `Alt + Shift + A`
2. Type an app name (e.g. `WeChat`, `Spotify`) and press Enter
3. Left click to insert, right click for more

## FAQ

**An app doesn't show up.**

Switch the storefront in the top right corner. Some apps are only listed in specific regions.

**Where are the icons stored?**

`workspace/data/emojis/appstore/`, which syncs with your other devices.

**Does uninstalling the plugin delete the icons?**

No. Downloaded files stay on disk.

## Notice

- Artwork comes from the App Store and remains the property of each app developer. Fine for personal use, do not redistribute commercially.
- This plugin only searches and downloads; it hosts no icon assets.

## License

MIT
