# StickyNote Premium Workspace 🎨

A modern, highly secure, offline-first productivity workspace and note-taking Chrome extension. Featuring a stunning glassmorphism design system, a dual-layout interface (Launcher & Workspace views), Raycast/Spotlight-inspired Command Palette, interactive Markdown checklist engine, multi-category Fake Data Generator, customizable editor typographies, and robust backup tools.

---

## 🚀 Key Differences & Improvements (v2.0 vs v1.0)
* **From Tabs to Rich Database Store**: Replaced the legacy 10-tab limit with a dynamic, local storage-backed document system containing unique IDs, categories (All, Favorites, Templates, Archive, Trash), and drag-and-drop manual ordering.
* **Dual Viewport Interface**: 
  - **Launcher Mode**: A compact, search-focused launcher optimized for quick popup actions, including a clipboard integration card and recent notes list.
  - **Workspace Mode**: A split-pane layout optimized for larger viewports or side panel views, featuring a collapsible sidebar, document lists, and a distraction-free canvas.
* **Raycast-Inspired Command Palette**: Access commands, swap themes, create notes, and search documents globally by pressing `Ctrl + K` or `/`.
* **Dynamic Markdown Parser**: Fast regex-based parser with real-time checkbox sync. Checking tasks inside the preview view automatically updates the underlying markdown syntax in the editor source.
* **Multi-Category Faker Engine**: Insert or copy realistic dummy datasets for mock database seeding, software testing, or development.

---

## ✨ Feature Breakdown

### 🖥️ Dual-Layout Experience
* **Launcher Mode** (Viewport width < 480px / height < 450px):
  - Dedicated search input to filter notes or actions instantly.
  - Quick action grid: New Note, Open Workspace, Open Fake Data, Open Settings.
  - **Clipboard Capture Card**: Live-reads extension sandbox clipboard text, offering one-click insertion of clipboard contents into a new note.
  - Recent Notes list for high-priority files access.
* **Workspace Mode** (Viewport width >= 480px / height >= 450px, e.g., Side Panel):
  - Collapsible left sidebar to toggle note list sections.
  - Custom note folders: **All Notes**, **Favorites**, **Templates**, **Archive**, and **Trash** (with a safety net).
  - Drag-and-drop support to manually reorder documents within the sidebar list.

### ✍️ Distraction-Free Editor & Markdown
* **Real-time Live Preview**: View parsed Markdown styles including headers (`#`, `##`, `###`), bold (`**`), italics (`*`), blockquotes (`>`), dividers (`---`), links (`[text](url)`), code blocks, and lists (`-`).
* **Interactive Checklists**: Toggling checklist tasks (`- [ ]` / `- [x]`) within the Markdown preview syncs updates back to the textarea.
* **Smart List Mode**: Pressing `Enter` automatically creates a consecutive bullet item (supports `•`, `○`, `▪`, `→`, `✓`).
* **Status Bar Tools**: Real-time autosave status indicator, character and word counters, line & column cursor tracker.

### ⚡ Command Palette (`Ctrl + K` or `/`)
A Spotlight-style navigation menu allowing you to:
* Search note content and titles globally.
* Switch interface themes instantly.
* Trigger system actions: Create note, open settings dashboard, launch Side Panel, trigger fake data generation, and export/import workspace.

### 🎲 Fake Data Generator (Faker)
Quickly seed details directly into your cursor placement. It is categorized into seven tabs:
1. **Personal**: Full Name, Email Address, Phone Number, Avatar URL.
2. **Business**: Company Name, Job Title, Buzzword Phrase, UUID v4.
3. **Developer**: IPv4 Address, MAC Address, Hex Color, User Agent.
4. **Finance**: Credit Card, IBAN Code, Currency Amount, Bitcoin.
5. **Security**: Strong Password, SHA-256 Hash, API Token.
6. **Address**: Street Address, City & Zip, Country.
7. **Internet**: Website Domain, Username, Hashtag.

### 🎨 Themes & Custom Accents
* **11 Curated Themes**: Minimal White, Professional Dark, Midnight Blue, Deep Ocean, Aurora Neon, Warm Sunset, Emerald Forest, Purple Royal, Glassmorphism (blur and saturation presets), Graphite Monospaced, and Random Gradient.
* **Color Customization**: Fine-tune focus highlights, indicator badges, and glowing borders using the custom accent color override.

### ⚙️ Settings Dashboard
* **Workflow Configuration**: Toggle side panel auto-activation and configure custom autosave delay settings (100ms - 5000ms).
* **Typography Controls**: Choose between 10 fonts (Geist Sans, Inter, Poppins, Outfit, JetBrains Mono, Fira Code, Lora, Playfair Display, Merriweather, Comic Neue) and customize font size scales (11px - 24px).
* **Backup & Portability**: Export your workspace as a `.json` backup file or restore database files easily. Contains a safety-protected **Factory Reset** to clear local storage.
* **Capacity Tracker**: Live computation of workspace size against Chrome's `5MB` local storage limit.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Escape` | Dismiss open modals, command palette, context menu, formatting toolbar |
| `Ctrl / Cmd + K` or `/` | Toggle Command Palette (when not typing in fields) |
| `Ctrl / Cmd + T` | Create New Note (redirects to Workspace if in Launcher) |
| `Ctrl / Cmd + R` | Focus and rename current note title |
| `Ctrl / Cmd + L` | Toggle Edit vs Markdown Preview Mode |
| `Ctrl / Cmd + Y` | Cycle through workspace themes |
| `Ctrl + Shift + D` | Insert all fake data fields (Faker trigger) |
| `Ctrl / Cmd + E` | Export JSON Workspace backup |
| `Ctrl / Cmd + S` | Force manual save |
| `Ctrl / Cmd + N` | Switch to the next note |
| `Ctrl / Cmd + 1-9` | Switch to notes 1-9 respectively |

---

## 🛠️ Technical Details & Security
* **Manifest V3 Architecture**: Designed for modern Google Chrome specifications.
* **Sidecar Background Processing**: Managed by a persistent service worker `background.js` to control window resizing and side panel popups.
* **CSP Compliant**: Secure extension environment with zero inline script executions.
* **Lucide Icon Library**: Uses `lucide-icons.js` for fast SVG rendering.
* **Layout Flash Prevention**: Integrates `init.js` early in the header context to pre-compute side panel widths and avoid layout flicker.
* **100% Offline-First**: Zero external dependencies (calls to `randomuser.me` or `unsplash` are handled client-side or mocked) to guarantee note privacy.

---

## 📦 Directory Structure

```
sticky-notes/
├── manifest.json       # Chrome MV3 configuration manifest
├── background.js       # Background service worker (mode switching and side panel management)
├── init.js             # Early initialization script (prevents flash of layout on load)
├── lucide-icons.js     # Offline-friendly Lucide icons library
├── popup.html          # Main HTML structure containing Launcher & Workspace containers
├── popup.js            # Main extension code (state, editor, faker & palette logic)
├── styles.css          # Glassmorphism styling and themes design system
├── ReadMe.md           # Documentation readme file
└── icons/              # Product icons asset files (16, 32, 48, 128px)
```

---

## 🚀 Installation & Setup
1. Clone or download this repository to your local system.
2. Open Google Chrome and enter `chrome://extensions/` in the address bar.
3. Turn on the **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Choose the directory containing the extension files.
6. Pin **StickyNote** to your extension bar. Open it as a Popup, or toggle **Enable Browser Side Panel** inside Settings to anchor it persistent alongside your web tabs!

---

**Made with ❤️ for distraction-free note taking.**
