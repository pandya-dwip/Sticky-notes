# StickyNote 🎨

A modern, beautiful Chrome extension for note-taking with advanced features and a stunning glassmorphism UI. Now with **Side Panel** support for a seamless, persistent note-taking experience.

## ✨ Features

### 🎯 Core Features

- **Browser Side Panel** - Keep your notes open alongside your web pages for persistent workflows.
- **Multi-Tab Support** - Organize notes across up to 10 tabs.
- **Smart Tab Management** - Pin important tabs, rename, and reorder.
- **Auto-Save** - Never lose your work with automatic local sync.
- **List Mode** - Enhanced bullet point creation with smart formatting.
- **Word Count & Stats** - Track characters, words, lines, and reading time.

### 🎨 Beautiful Design

- **Glassmorphism UI** - Modern glass-effect design with advanced blur and saturation.
- **Advanced Themes** - Light, Dark, Random, and Custom theme options.
- **Ambient Animations** - Floating gradient orbs for a premium look and feel.
- **Responsive Layout** - UI automatically adjusts for popup or narrow/wide side panel views.
- **Smooth Transitions** - Buttery-smooth opacity and transform animations throughout.

### 🛠️ Quick Tools

- **Instant Data Generation** - Generate fake names, emails, phones, addresses, dates, cards, passwords.
- **Copy & Export** - One-click copy or JSON backup export.
- **Keyboard Shortcuts** - Power user workflows for maximum productivity.

## 🚀 Installation

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right.
4. Click "Load unpacked".
5. Select the folder containing the extension files.
6. Click the extension icon to open the **Popup**, or enable **Side Panel** mode in Settings!

## ⌨️ Keyboard Shortcuts

| Shortcut           | Action                     |
| ------------------ | -------------------------- |
| `Ctrl + T`         | New Tab                    |
| `Ctrl + R`         | Rename Tab                 |
| `Delete`           | Delete Tab                 |
| `Ctrl + L`         | Toggle List Mode           |
| `Ctrl + Y`         | Cycle Themes               |
| `Ctrl + Shift + D` | Quick Data (Random Insert) |
| `Ctrl + E`         | Export Notes               |
| `Ctrl + S`         | Manual Save                |
| `Ctrl + N`         | Next Tab                   |
| `Ctrl + 1-9`       | Switch to Tab 1-9          |
| `Ctrl + 0`         | Switch to Tab 10           |

## ⚙️ Settings & Side Panel

- **Open in Side Panel**: Toggle this setting to move StickyNote into the browser's side panel.
- **Auto-Switching**: Toggling Side Panel mode on will automatically open the panel and close the popup for a seamless transition.
- **Instant Load**: Advanced detection logic ensures the UI fits the side panel perfectly from the moment it opens.

## 🎨 Themes

- **Light** - Clean, minimal high-contrast theme.
- **Dark** - Sleek dark mode optimized for night workflows.
- **Random** - Generate a unique color gradient instantly.
- **Custom** - Choose between classic solid styles or curated modern gradient presets.

## 📝 Usage Tips

### Tab Management

- Click the **pin icon** on any tab to keep it at the front of the list.
- Click the **Edit** icon to rename the current tab.
- Pinned tabs are always sorted to the left for easy access.

### List Mode

- Enable List Mode via the toolbar or `Ctrl + L`.
- Press **Enter** to create new list items with automatic bullet point insertion.
- Enjoys a variety of bullet styles (•, ○, ▪, →, ✓) for easy scannability.

### Quick Data

Insert realistic test data with one click:

- 👤 **Names**, 📧 **Emails**, 📞 **Phones**, 📍 **Addresses**, 📅 **Dates**, 💳 **Cards**, 🔑 **Passwords**.

## 🔧 Technical Details

- **Manifest V3**: Using modern extension architecture.
- **Service Worker**: Efficient background processing for mode switching.
- **Storage**: Chrome Local Storage API for safe, local data persistence.
- **CSP Compliant**: Secure script handling with zero inline script violations.
- **Responsive**: Dynamic CSS media queries for all viewports.

## 📦 File Structure

```
stickynote/
├── popup.html          # Main UI structure
├── styles.css          # Premium glassmorphism styling
├── popup.js            # Core application logic
├── init.js             # Early initialization (Side Panel detection)
├── background.js       # Background service worker (Mode switching)
├── manifest.json       # Extension configuration
└── icons/              # Extension icons (16, 32, 48, 128px)
```

## 📄 License

MIT License - Feel free to modify and distribute.

---

**Made with ❤️ for productive note-taking**
