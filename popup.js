// StickyNote - SaaS Workspace & Launcher Logic

// Polyfill for standard browser environments (enables direct preview and testing in normal web page tabs)
if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
  window.chrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          let res = {};
          const parseVal = (v, fallback) => {
            if (v === null || v === undefined) return fallback;
            try { return JSON.parse(v); } catch { return v; }
          };
          if (Array.isArray(keys)) {
            keys.forEach(k => { res[k] = parseVal(localStorage.getItem(k), undefined); });
          } else if (typeof keys === "object") {
            Object.keys(keys).forEach(k => { res[k] = parseVal(localStorage.getItem(k), keys[k]); });
          } else if (typeof keys === "string") {
            res[keys] = parseVal(localStorage.getItem(keys), undefined);
          }
          setTimeout(() => callback(res), 50);
        },
        set: (data, callback) => {
          Object.keys(data).forEach(k => {
            localStorage.setItem(k, JSON.stringify(data[k]));
          });
          if (callback) setTimeout(callback, 50);
        },
        clear: (callback) => {
          localStorage.clear();
          if (callback) setTimeout(callback, 50);
        }
      }
    },
    windows: {
      getCurrent: async () => ({ id: 1 })
    },
    sidePanel: {
      open: async () => { console.log("Mock sidePanel.open"); },
      setPanelBehavior: async () => { }
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  let notes = [];
  let activeNoteId = null;
  let activeSection = "all"; // 'all', 'favorites', 'templates', 'archive', 'trash'
  let sidebarCollapsed = false;
  let previewMode = false;
  let autosaveTimeout = null;
  let undoDeleteStack = [];

  // Default settings
  let settings = {
    sidePanelEnabled: false,
    autosaveDelay: 300,
    theme: "theme-prof-dark",
    customAccentColor: "",
    listModeEnabled: false,
    editorFontFamily: "var(--font-sans)",
    editorFontSize: 14,
  };

  // Viewport detection
  const urlParams = new URLSearchParams(window.location.search);
  const sidePanelMode =
    urlParams.get("mode") === "sidepanel" ||
    window.innerWidth > 480 ||
    window.innerHeight > 450;

  // DOM Elements
  const body = document.body;
  const workspaceContainer = document.getElementById("workspace-container");
  const launcherContainer = document.getElementById("launcher-container");

  // Sidebar elements
  const sidebar = document.getElementById("sidebar");
  const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");
  const sidebarExpandBtn = document.getElementById("sidebar-expand-btn");
  const sidebarSearchBtn = document.getElementById("sidebar-search-btn");
  const sidebarAddNoteBtn = document.getElementById("sidebar-add-note-btn");
  const notesListContainer = document.getElementById("notes-list-container");
  const sidebarListTitle = document.getElementById("sidebar-list-title");

  // Section buttons & Badges
  const secAll = document.getElementById("sec-all");
  const secFavorites = document.getElementById("sec-favorites");
  const secTemplates = document.getElementById("sec-templates");
  const secArchive = document.getElementById("sec-archive");
  const secTrash = document.getElementById("sec-trash");
  const badgeAll = document.getElementById("badge-all");
  const badgeFavorites = document.getElementById("badge-favorites");
  const badgeTemplates = document.getElementById("badge-templates");
  const badgeArchive = document.getElementById("badge-archive");
  const badgeTrash = document.getElementById("badge-trash");

  // Capacity
  const capacityPercentage = document.getElementById("capacity-percentage");
  const capacityFill = document.getElementById("capacity-fill");
  const cycleThemeBtn = document.getElementById("cycle-theme-btn");
  const sidebarSettingsBtn = document.getElementById("sidebar-settings-btn");
  const syncIcon = document.getElementById("sync-icon");
  const syncText = document.getElementById("sync-text");

  // Editor Pane elements
  const noteTitleInput = document.getElementById("note-title-input");
  const noteTextarea = document.getElementById("note-textarea");
  const notePreview = document.getElementById("note-preview");
  const editorTogglePreview = document.getElementById("editor-toggle-preview");
  const editorToggleFavorite = document.getElementById("editor-toggle-favorite");
  const editorTogglePin = document.getElementById("editor-toggle-pin");
  const editorMenuTrigger = document.getElementById("editor-menu-trigger");
  const editorMenuDropdown = document.getElementById("editor-menu-dropdown");
  const editorBackToLauncher = document.getElementById("editor-back-to-launcher");

  // Menu items
  const menuItemDuplicate = document.getElementById("menu-item-duplicate");
  const menuItemTemplate = document.getElementById("menu-item-template");
  const menuItemArchive = document.getElementById("menu-item-archive");
  const menuItemDelete = document.getElementById("menu-item-delete");

  // Editor Status Bar
  const saveStatusIcon = document.getElementById("save-status-icon");
  const saveStatusText = document.getElementById("save-status-text");
  const charCounter = document.getElementById("editor-char-counter");
  const wordCounter = document.getElementById("editor-word-counter");
  const readingTime = document.getElementById("editor-reading-time");
  const cursorCounter = document.getElementById("editor-cursor-pos");
  const themeBadge = document.getElementById("editor-theme-badge");

  // Launcher Elements
  const launcherSearchInput = document.getElementById("launcher-search");
  const launcherNewBtn = document.getElementById("launcher-new-btn");
  const launcherSideBtn = document.getElementById("launcher-side-btn");
  const launcherFakerBtn = document.getElementById("launcher-faker-btn");
  const launcherSettingsBtn = document.getElementById("launcher-settings-btn");
  const clipboardPreviewText = document.getElementById("clipboard-preview-text");
  const clipboardInsertBtn = document.getElementById("clipboard-insert-btn");
  const launcherNotesList = document.getElementById("launcher-notes-list");

  // Floating selection formatting toolbar
  const floatingToolbar = document.getElementById("floating-toolbar");

  // Modals Elements
  const commandPaletteModal = document.getElementById("command-palette-modal");
  const paletteSearchInput = document.getElementById("palette-search-input");
  const paletteOptionsList = document.getElementById("palette-options-list");
  const paletteEmptyState = document.getElementById("palette-empty-state");

  const fakerModal = document.getElementById("faker-modal");
  const fakerTabs = document.getElementById("faker-tabs");
  const fakerModalClose = document.getElementById("faker-modal-close");
  const fakerLogsList = document.getElementById("faker-logs-list");

  const settingsModal = document.getElementById("settings-modal");
  const settingsModalClose = document.getElementById("settings-modal-close");
  const settingsTabs = document.querySelector(".settings-tabs");
  const settingsPanes = document.querySelector(".settings-panes");

  // Settings Dashboard fields
  const settingSidePanelToggle = document.getElementById("setting-side-panel-toggle");
  const settingAutosaveDelay = document.getElementById("setting-autosave-delay");
  const settingCustomAccent = document.getElementById("setting-custom-accent");
  const settingResetAccent = document.getElementById("setting-reset-accent");
  const settingListModeToggle = document.getElementById("setting-list-mode-toggle");
  const settingEditorFont = document.getElementById("setting-editor-font");
  const settingFontSize = document.getElementById("setting-font-size");
  const settingsExportBtn = document.getElementById("settings-export-btn");
  const settingsImportBtn = document.getElementById("settings-import-btn");
  const settingsImportFile = document.getElementById("settings-import-file");
  const settingsClearBtn = document.getElementById("settings-clear-btn");
  const themesGrid = document.getElementById("themes-grid");

  // Context Menu
  const customContextMenu = document.getElementById("custom-context-menu");
  let rightClickedNoteId = null;

  // Fake Data generators lists
  const fakerMap = {
    personal: {
      name: { title: "Full Name", desc: "Random human name", run: () => generateRandomName() },
      email: { title: "Email Address", desc: "Random mock email", run: () => generateRandomEmail() },
      phone: { title: "Phone Number", desc: "Format: (555) 000-0000", run: () => generateRandomPhone() },
      avatar: { title: "Avatar URL", desc: "Unsplash portrait photo", run: () => `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=150&h=150&fit=crop` }
    },
    business: {
      company: { title: "Company Name", desc: "Creative corporate name", run: () => generateRandomCompany() },
      job: { title: "Job Title", desc: "Corporate business role", run: () => generateRandomJob() },
      bs: { title: "Buzzword Phrase", desc: "Corporate placeholder jargon", run: () => generateRandomBS() },
      uuid: { title: "UUID v4", desc: "Universally unique identifier", run: () => generateUUID() }
    },
    developer: {
      ip: { title: "IPv4 Address", desc: "Random local or public IP", run: () => `${rand(1, 254)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}` },
      mac: { title: "MAC Address", desc: "Standard hex physical code", run: () => Array.from({ length: 6 }, () => rand(0, 255).toString(16).padStart(2, '0')).join(':').toUpperCase() },
      color: { title: "Hex Color", desc: "Random hex color string", run: () => `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}` },
      useragent: { title: "User Agent", desc: "Mock Chrome user agent", run: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    },
    finance: {
      card: { title: "Credit Card", desc: "Luhn-valid visa card format", run: () => generateCreditCard() },
      iban: { title: "IBAN Code", desc: "International bank number", run: () => "GB" + rand(10, 99) + "BARC" + rand(100000, 999999) + rand(10000000, 99999999) },
      amount: { title: "Currency Amount", desc: "Value: $10.00 to $9,999.00", run: () => `$${rand(10, 9999)}.${rand(10, 99).toString().padStart(2, '0')}` },
      bitcoin: { title: "BTC Wallet Address", desc: "Mock crypto token code", run: () => "1" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) }
    },
    security: {
      password: { title: "Strong Password", desc: "16-char mixed alphanumeric", run: () => generatePassword(16) },
      hash: { title: "SHA-256 Hash", desc: "Mock cryptographic key", run: () => Array.from({ length: 64 }, () => rand(0, 15).toString(16)).join('') },
      apiKey: { title: "API Token", desc: "Standard app developer token", run: () => "sk_live_" + generatePassword(32) }
    },
    address: {
      street: { title: "Street Address", desc: "House number and road", run: () => generateRandomAddress() },
      city: { title: "City & Zip", desc: "Major city name and post code", run: () => generateRandomCity() },
      country: { title: "Country", desc: "Global nation name", run: () => ["United States", "United Kingdom", "Canada", "Germany", "France", "Japan", "Australia", "India"][rand(0, 7)] }
    },
    internet: {
      url: { title: "Website Domain", desc: "Mock landing page URL", run: () => `https://www.${generateRandomCompany().toLowerCase().replace(/[^a-z0-9]/g, '')}.com` },
      username: { title: "Username", desc: "Social handles style", run: () => generateRandomName().toLowerCase().replace(' ', '_') + rand(10, 99) },
      hashtag: { title: "Hashtag", desc: "Trending social hash tag", run: () => "#" + ["productivity", "notetaking", "workspace", "minimalism", "design", "coding", "focus"][rand(0, 6)] }
    }
  };

  const themesList = [
    { id: "theme-minimal-white", name: "Minimal White", dark: false, primary: "#ffffff", sidebar: "#f3f4f6", accent: "#111827" },
    { id: "theme-prof-dark", name: "Professional Dark", dark: true, primary: "#1e293b", sidebar: "#0b0f19", accent: "#6366f1" },
    { id: "theme-midnight", name: "Midnight Blue", dark: true, primary: "#0f172a", sidebar: "#000000", accent: "#06b6d4" },
    { id: "theme-ocean", name: "Deep Ocean", dark: true, primary: "#0f172a", sidebar: "#0c1e2d", accent: "#38bdf8" },
    { id: "theme-aurora", name: "Aurora Neon", dark: true, primary: "#1e1145", sidebar: "#09041a", accent: "#10b981" },
    { id: "theme-sunset", name: "Warm Sunset", dark: true, primary: "#2b0e1d", sidebar: "#0f050b", accent: "#f97316" },
    { id: "theme-forest", name: "Emerald Forest", dark: true, primary: "#0a3020", sidebar: "#03120b", accent: "#34d399" },
    { id: "theme-purple", name: "Purple Royal", dark: true, primary: "#260f3d", sidebar: "#0d0317", accent: "#d8b4fe" },
    { id: "theme-glass", name: "Glassmorphism", dark: true, primary: "rgba(15,23,42,0.4)", sidebar: "rgba(15,23,42,0.4)", accent: "#818cf8" },
    { id: "theme-graphite", name: "Graphite Monospaced", dark: true, primary: "#27272a", sidebar: "#09090b", accent: "#fafafa" },
    { id: "theme-random", name: "Random Gradient", dark: true, primary: "linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)", sidebar: "rgba(10,15,30,0.5)", accent: "#818cf8" }
  ];

  let randomGradient = "";

  // Initialize View UI Mode classes
  if (sidePanelMode) {
    body.classList.add("side-panel-mode");
    workspaceContainer.style.display = "flex";
    launcherContainer.style.display = "none";
  } else {
    body.classList.remove("side-panel-mode");
    workspaceContainer.style.display = "none";
    launcherContainer.style.display = "flex";
    launcherSearchInput.focus();
    if (editorBackToLauncher) {
      editorBackToLauncher.style.display = "flex";
      editorBackToLauncher.addEventListener("click", showLauncherView);
    }
  }

  // ==========================================================================
  // INITIAL LOAD & MIGRATIONS
  // ==========================================================================
  chrome.storage.local.get(
    ["tabs", "activeTab", "activeNoteId", "editorSettings", "fakerHistory", "randomGradient"],
    (res) => {
      // Load Settings
      if (res.editorSettings) {
        settings = { ...settings, ...res.editorSettings };
      }
      randomGradient = res.randomGradient || "";

      // Load and migrate tabs to notes
      const rawTabs = Array.isArray(res.tabs) ? res.tabs : [];
      notes = rawTabs
        .filter((t) => t && typeof t === "object")
        .map((tab, idx) => {
          return {
            id: tab.id || `note_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            title: tab.title || tab.name || "Untitled Note",
            content: tab.content || "",
            pinned: tab.pinned || false,
            favorite: tab.favorite || false,
            archived: tab.archived || false,
            trash: tab.trash || false,
            isTemplate: tab.isTemplate || false,
            created: tab.created || Date.now(),
            modified: tab.modified || Date.now(),
          };
        });

      // Verify at least one note exists
      if (notes.length === 0) {
        const defaultNoteId = `note_${Date.now()}`;
        notes.push({
          id: defaultNoteId,
          title: "Welcome to StickyNote 🎨",
          content: `# StickyNote Premium Workspace\n\nThis is your new productivity workspace. You can quickly capture notes, structure documents, and use premium tools.\n\n### 🚀 Features Included:\n- **Command Palette**: Press \`Ctrl+K\` or \`/\` to search notes, themes, and insert fake data.\n- **Markdown Rendering**: Toggle the Eye button on the header to see premium formatted documents.\n- **Fake Data generator**: Insert address, credit card, company details in one click.\n- **Customizable Themes**: Open settings to cycle between 10 elegant styles.\n\nEnjoy writing!`,
          pinned: true,
          favorite: true,
          archived: false,
          trash: false,
          isTemplate: false,
          created: Date.now(),
          modified: Date.now(),
        });
      }

      // Load active Note ID
      activeNoteId = res.activeNoteId || null;
      // Fallback if the activeNoteId is not valid
      if (!activeNoteId || !notes.some(n => n.id === activeNoteId)) {
        activeNoteId = notes.find(n => !n.trash && !n.archived)?.id || notes[0].id;
      }

      // Load fake data logs history
      if (Array.isArray(res.fakerHistory)) {
        renderFakerLogs(res.fakerHistory);
      }

      // Synchronize settings dashboard UI
      settingSidePanelToggle.checked = settings.sidePanelEnabled;
      settingAutosaveDelay.value = settings.autosaveDelay;
      settingListModeToggle.checked = settings.listModeEnabled;
      settingEditorFont.value = settings.editorFontFamily;
      settingFontSize.value = settings.editorFontSize;
      if (settings.customAccentColor) {
        settingCustomAccent.value = settings.customAccentColor;
      }

      // Apply initial styling settings
      applyTheme(settings.theme);
      applyCustomAccent(settings.customAccentColor);
      applyEditorSettings();

      // Render Themes Grid in settings
      renderThemesGrid();

      // Bind all dynamic items
      renderNotesList();
      loadActiveNote();
      updateCapacityIndicator();

      // Render Lucide icons initially
      window.lucide.render();

      if (!sidePanelMode) {
        updateClipboardPreview();
        renderLauncherRecentNotes();
      }
    }
  );

  // ==========================================================================
  // VIEW RENDERERS
  // ==========================================================================

  // Render notes list sidebar
  function renderNotesList() {
    notesListContainer.innerHTML = "";

    // Count and update section badges
    const counts = { all: 0, favorites: 0, templates: 0, archive: 0, trash: 0 };
    notes.forEach(n => {
      if (n.trash) counts.trash++;
      else if (n.archived) counts.archive++;
      else {
        counts.all++;
        if (n.favorite) counts.favorites++;
        if (n.isTemplate) counts.templates++;
      }
    });

    if (badgeAll) badgeAll.textContent = counts.all;
    if (badgeFavorites) badgeFavorites.textContent = counts.favorites;
    if (badgeTemplates) badgeTemplates.textContent = counts.templates;
    if (badgeArchive) badgeArchive.textContent = counts.archive;
    if (badgeTrash) badgeTrash.textContent = counts.trash;

    // Filter notes list shown in sidebar
    let filteredNotes = notes.filter(n => {
      if (activeSection === "trash") return n.trash;
      if (activeSection === "archive") return n.archived && !n.trash;
      if (n.trash || n.archived) return false;

      if (activeSection === "all") return true;
      if (activeSection === "favorites") return n.favorite;
      if (activeSection === "templates") return n.isTemplate;
      return true;
    });

    // Sort notes: Pinned notes always at top, then by modified desc
    filteredNotes.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
      return b.modified - a.modified;
    });

    sidebarListTitle.textContent = activeSection.charAt(0).toUpperCase() + activeSection.slice(1) + " Notes";

    if (filteredNotes.length === 0) {
      renderEmptyState();
      return;
    }

    filteredNotes.forEach(note => {
      const card = document.createElement("div");
      card.className = `note-item-card ${note.id === activeNoteId ? "active" : ""}`;
      card.setAttribute("draggable", "true");
      card.dataset.id = note.id;

      // Card Header
      const titleRow = document.createElement("div");
      titleRow.className = "note-item-title-row";

      const docIcon = document.createElement("span");
      docIcon.className = "note-item-icon";
      docIcon.setAttribute("data-lucide", note.isTemplate ? "book-open" : "file-text");
      docIcon.style.width = "16px";
      docIcon.style.height = "16px";

      const titleSpan = document.createElement("span");
      titleSpan.className = "note-item-title";
      titleSpan.textContent = note.title || "Untitled Note";

      titleRow.appendChild(docIcon);
      titleRow.appendChild(titleSpan);

      // Pins indicators
      if (note.pinned && activeSection !== "trash") {
        const pinSpan = document.createElement("span");
        pinSpan.className = "note-item-pin-indicator";
        pinSpan.setAttribute("data-lucide", "pin");
        pinSpan.style.width = "12px";
        pinSpan.style.height = "12px";
        titleRow.appendChild(pinSpan);
      }

      card.appendChild(titleRow);

      // Preview snippet
      const previewText = document.createElement("div");
      previewText.className = "note-item-preview";
      previewText.textContent = getSnippetPreview(note.content);
      card.appendChild(previewText);

      // Meta date
      const metaRow = document.createElement("div");
      metaRow.className = "note-item-meta";
      metaRow.textContent = getRelativeTime(note.modified);
      card.appendChild(metaRow);

      // Card Click handler
      card.addEventListener("click", () => {
        selectNote(note.id);
      });

      // Context menu right-click trigger
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(note.id, e.clientX, e.clientY);
      });

      // Drag & Drop event bindings
      card.addEventListener("dragstart", handleDragStart);
      card.addEventListener("dragover", handleDragOver);
      card.addEventListener("drop", handleDrop);
      card.addEventListener("dragend", handleDragEnd);

      notesListContainer.appendChild(card);
    });

    window.lucide.render(notesListContainer);
  }

  // Render empty placeholder UI
  function renderEmptyState() {
    let title = "No notes found";
    let desc = "Create a new idea to get started.";
    let iconName = "file-text";

    if (activeSection === "favorites") {
      title = "No favorites yet";
      desc = "Star notes to see them pinned here.";
      iconName = "star";
    } else if (activeSection === "templates") {
      title = "No templates saved";
      desc = "Save layout docs as templates for reuse.";
      iconName = "book-open";
    } else if (activeSection === "archive") {
      title = "Archive is empty";
      desc = "Clean up your list by archiving old notes.";
      iconName = "archive";
    } else if (activeSection === "trash") {
      title = "Trash is empty";
      desc = "Notes you move to trash will appear here.";
      iconName = "trash";
    }

    notesListContainer.innerHTML = `
      <div class="empty-state-wrap">
        <div class="empty-state-icon-box">
          <span data-lucide="${iconName}" style="width: 28px; height: 28px;"></span>
        </div>
        <div class="empty-state-text-wrap">
          <div class="empty-state-title">${title}</div>
          <div class="empty-state-desc">${desc}</div>
        </div>
        ${activeSection !== "trash" ? `<button id="empty-state-new-btn" class="btn-primary" style="padding: 6px 12px; font-size: 11px;">Create Note</button>` : ""}
      </div>
    `;

    window.lucide.render(notesListContainer);

    const emptyNewBtn = document.getElementById("empty-state-new-btn");
    if (emptyNewBtn) {
      emptyNewBtn.addEventListener("click", createNewNote);
    }

    // Hide editor inputs if no notes selected or available
    hideEditorInputs(true);
  }

  function hideEditorInputs(hide) {
    if (hide) {
      noteTitleInput.value = "";
      noteTextarea.value = "";
      noteTitleInput.disabled = true;
      noteTextarea.disabled = true;
      noteTitleInput.placeholder = "Select or create a note...";
      noteTextarea.placeholder = "";
      editorTogglePreview.disabled = true;
      editorToggleFavorite.disabled = true;
      editorTogglePin.disabled = true;
      editorMenuTrigger.disabled = true;
    } else {
      noteTitleInput.disabled = false;
      noteTextarea.disabled = false;
      noteTitleInput.placeholder = "Untitled Note";
      noteTextarea.placeholder = "Start writing thoughts here...";
      editorTogglePreview.disabled = false;
      editorToggleFavorite.disabled = false;
      editorTogglePin.disabled = false;
      editorMenuTrigger.disabled = false;
    }
  }

  // Load and focus active note content in the editor
  function loadActiveNote() {
    const activeNote = notes.find((n) => n.id === activeNoteId);

    if (!activeNote || activeNote.trash) {
      // Find another available note if active note is missing/trashed
      const fallback = notes.find((n) => !n.trash && !n.archived);
      if (fallback) {
        activeNoteId = fallback.id;
        loadActiveNote();
      } else {
        activeNoteId = null;
        hideEditorInputs(true);
      }
      return;
    }

    hideEditorInputs(false);

    // Setup active styles
    noteTitleInput.value = activeNote.title;
    noteTextarea.value = activeNote.content;

    // Toggle pin/favorite state styling
    editorTogglePin.classList.toggle("active", activeNote.pinned);
    editorToggleFavorite.classList.toggle("active", activeNote.favorite);

    // Synchronize preview modes
    if (previewMode) {
      renderMarkdownPreview();
    } else {
      noteTextarea.style.display = "block";
      notePreview.style.display = "none";
      editorTogglePreview.innerHTML = window.lucide.get("eye");
      window.lucide.render(editorTogglePreview);
    }

    updateStats();
    updateEditorCursorPos();
  }

  // Snippet string extractor helper
  function getSnippetPreview(content) {
    if (!content) return "Empty Note";
    // Strip markdown formatting simple approach
    let text = content
      .replace(/[#*`>_\-[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text.substring(0, 50) + (text.length > 50 ? "..." : "");
  }

  // Relative timestamp formatting
  function getRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  // ==========================================================================
  // NOTE LOGIC ACTIONS
  // ==========================================================================

  function createNewNote(content = "", title = "Untitled Note") {
    if (activeSection === "trash") {
      activeSection = "all";
      document.querySelectorAll(".sidebar-section-item").forEach(i => i.classList.remove("active"));
      secAll.classList.add("active");
    }

    const newId = `note_${Date.now()}`;
    const newNote = {
      id: newId,
      title: title,
      content: content,
      pinned: false,
      favorite: false,
      archived: false,
      trash: false,
      isTemplate: activeSection === "templates",
      created: Date.now(),
      modified: Date.now(),
    };

    notes.push(newNote);
    activeNoteId = newId;

    renderNotesList();
    loadActiveNote();
    saveData();
    showToast("New note created");

    noteTextarea.focus();
  }

  function selectNote(id) {
    if (activeNoteId === id) return;
    activeNoteId = id;
    loadActiveNote();
    renderNotesList();
    chrome.storage.local.set({ activeNoteId });
  }

  function handleNoteHoverAction(noteId, action) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    if (action === "pin") {
      note.pinned = !note.pinned;
      note.modified = Date.now();
      showToast(note.pinned ? "Note pinned" : "Note unpinned");
    } else if (action === "favorite") {
      note.favorite = !note.favorite;
      note.modified = Date.now();
      showToast(note.favorite ? "Added to Favorites" : "Removed from Favorites");
    } else if (action === "delete") {
      note.trash = true;
      note.modified = Date.now();
      undoDeleteStack.push({ ...note });
      showToast("Note moved to Trash", true);
      if (activeNoteId === noteId) activeNoteId = null;
    } else if (action === "restore") {
      note.trash = false;
      note.modified = Date.now();
      showToast("Note restored");
    } else if (action === "purge") {
      if (confirm("Delete this note permanently? This action cannot be undone.")) {
        notes = notes.filter(n => n.id !== noteId);
        showToast("Note permanently deleted");
      }
    }

    renderNotesList();
    loadActiveNote();
    saveData();
  }

  // ==========================================================================
  // MARKDOWN RENDER SYSTEM & DYNAMIC CHECKBOXES
  // ==========================================================================

  function renderMarkdownPreview() {
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (!activeNote) return;

    const raw = activeNote.content || "*No content to preview*";

    // Complex regex-based Markdown parsing to retain speed and offline compliance
    let html = raw
      // Escape HTML entities to prevent CSS/DOM injections
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Checklist parsed with index mapping for sync backs
      .replace(/^- \[ \]/gm, (m, offset) => {
        return `<div class="markdown-checklist-item" data-offset="${offset}"><span class="markdown-checkbox" data-offset="${offset}"></span><span class="markdown-checklist-content">`;
      })
      .replace(/^- \[x\]/gm, (m, offset) => {
        return `<div class="markdown-checklist-item checked" data-offset="${offset}"><span class="markdown-checkbox checked" data-offset="${offset}">${window.lucide.get("check")}</span><span class="markdown-checklist-content">`;
      })
      // Closed checklist wrapping tag
      .replace(/(?:<div class="markdown-checklist-item.*<\/span>)(.*)$/gm, "$&</div>")
      // Headings
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Code blocks
      .replace(/\`\`\`([\s\S]*?)\`\`\`/gm, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/\`([^`]+)\`/gm, '<code>$1</code>')
      // Bold & Italic
      .replace(/\*\*([^*]+)\*\*/gm, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/gm, '<em>$1</em>')
      // Dividers
      .replace(/^---$/gm, '<hr />')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gm, '<a href="$2" target="_blank">$1</a>')
      // Bullet list items
      .replace(/^- (?!\[ \]|\[x\])(.*$)/gim, '<li>$1</li>')
      // Map isolated list tags in wrapping elements
      .replace(/(<li>.*<\/li>)/gim, '<ul>$&</ul>')
      // Paragraph spacing
      .replace(/\n([^\n<>*#\-]+)\n/g, '<p>$1</p>')
      .replace(/\n\n/g, '<br/>');

    notePreview.innerHTML = html;

    // Bind click events on checkbox nodes for Markdown sync updates
    notePreview.querySelectorAll(".markdown-checkbox").forEach(box => {
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        const offset = parseInt(box.getAttribute("data-offset"));
        toggleMarkdownCheckboxState(offset);
      });
    });

    noteTextarea.style.display = "none";
    notePreview.style.display = "block";
    editorTogglePreview.innerHTML = window.lucide.get("eye-off");
    window.lucide.render(editorTogglePreview);
  }

  function toggleMarkdownCheckboxState(offset) {
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (!activeNote) return;

    let content = activeNote.content;
    const prefix = content.substring(offset, offset + 5);

    if (prefix === "- [ ]") {
      content = content.substring(0, offset) + "- [x]" + content.substring(offset + 5);
    } else if (prefix === "- [x]") {
      content = content.substring(0, offset) + "- [ ]" + content.substring(offset + 5);
    }

    activeNote.content = content;
    activeNote.modified = Date.now();

    // Re-render and save
    noteTextarea.value = content;
    renderMarkdownPreview();
    updateStats();
    triggerAutosave();
  }

  // ==========================================================================
  // FLOATING SELECTION FORMATTING TOOLBAR
  // ==========================================================================

  noteTextarea.addEventListener("mouseup", checkTextSelection);
  noteTextarea.addEventListener("keyup", checkTextSelection);

  function checkTextSelection() {
    const start = noteTextarea.selectionStart;
    const end = noteTextarea.selectionEnd;

    if (start === end) {
      floatingToolbar.classList.remove("visible");
      return;
    }

    // Get selection bounds coordinates
    const rect = noteTextarea.getBoundingClientRect();
    const toolbarHeight = 42;

    // Crude character count coordinate approximation
    const textLines = noteTextarea.value.substring(0, start).split("\n");
    const lineCount = textLines.length;
    const charInLine = textLines[textLines.length - 1].length;

    // Relative alignment position
    const top = rect.top + window.scrollY + (lineCount * 22) - toolbarHeight - 10;
    const left = rect.left + window.scrollX + (charInLine * 8) + 30;

    // Check bound boundary safeguards
    const finalTop = Math.max(rect.top - toolbarHeight, Math.min(top, rect.bottom));
    const finalLeft = Math.max(rect.left, Math.min(left, rect.right - 280));

    floatingToolbar.style.top = `${finalTop}px`;
    floatingToolbar.style.left = `${finalLeft}px`;
    floatingToolbar.classList.add("visible");
  }

  // Handle format inserts
  document.querySelectorAll(".toolbar-format-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const format = btn.getAttribute("data-format");
      applyTextFormatting(format);
    });
  });

  function applyTextFormatting(format) {
    const start = noteTextarea.selectionStart;
    const end = noteTextarea.selectionEnd;
    const val = noteTextarea.value;
    const selected = val.substring(start, end);

    let formattedText = selected;
    let cursorOffset = 0;

    switch (format) {
      case "bold":
        formattedText = `**${selected}**`;
        cursorOffset = 2;
        break;
      case "italic":
        formattedText = `*${selected}*`;
        cursorOffset = 1;
        break;
      case "heading":
        formattedText = `\n### ${selected}`;
        cursorOffset = 5;
        break;
      case "quote":
        formattedText = `\n> ${selected}`;
        cursorOffset = 3;
        break;
      case "code":
        formattedText = `\`\`\`\n${selected}\n\`\`\``;
        cursorOffset = 4;
        break;
      case "list":
        formattedText = `\n- ${selected}`;
        cursorOffset = 3;
        break;
      case "checklist":
        formattedText = `\n- [ ] ${selected}`;
        cursorOffset = 7;
        break;
      case "link":
        formattedText = `[${selected}](https://)`;
        cursorOffset = selected.length + 10;
        break;
    }

    noteTextarea.value = val.slice(0, start) + formattedText + val.slice(end);
    noteTextarea.selectionStart = start + cursorOffset;
    noteTextarea.selectionEnd = start + cursorOffset + selected.length;

    floatingToolbar.classList.remove("visible");
    noteTextarea.focus();

    // Trigger Save
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (activeNote) {
      activeNote.content = noteTextarea.value;
      activeNote.modified = Date.now();
      triggerAutosave();
      updateStats();
    }
  }

  // Hide formatting toolbar on click elsewhere
  document.addEventListener("mousedown", (e) => {
    if (!floatingToolbar.contains(e.target) && e.target !== noteTextarea) {
      floatingToolbar.classList.remove("visible");
    }
  });

  // ==========================================================================
  // QUICK COMMAND PALETTE (Raycast Style)
  // ==========================================================================

  let paletteSelectedIndex = 0;
  let paletteFilteredOptions = [];

  function openCommandPalette() {
    commandPaletteModal.classList.add("active");
    paletteSearchInput.value = "";
    paletteSearchInput.focus();
    renderPaletteOptions();
  }

  function closeCommandPalette() {
    commandPaletteModal.classList.remove("active");
  }

  // Listen to palette input searches
  paletteSearchInput.addEventListener("input", () => {
    paletteSelectedIndex = 0;
    renderPaletteOptions();
  });

  // Navigate Command options via keys
  paletteSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      paletteSelectedIndex = (paletteSelectedIndex + 1) % paletteFilteredOptions.length;
      updatePaletteSelectionHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      paletteSelectedIndex = (paletteSelectedIndex - 1 + paletteFilteredOptions.length) % paletteFilteredOptions.length;
      updatePaletteSelectionHighlight();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (paletteFilteredOptions[paletteSelectedIndex]) {
        executePaletteOption(paletteFilteredOptions[paletteSelectedIndex]);
      }
    } else if (e.key === "Escape") {
      closeCommandPalette();
    }
  });

  function renderPaletteOptions() {
    paletteOptionsList.innerHTML = "";
    const query = paletteSearchInput.value.toLowerCase().trim();

    // Prepare commands
    const actions = [
      { type: "action", id: "new-note", title: "Create New Note", desc: "Create a blank active document", icon: "plus" },
      { type: "action", id: "open-settings", title: "Open Settings", desc: "Configure extensions and themes", icon: "settings" },
      { type: "action", id: "open-side-panel", title: "Open in Side Panel", desc: "Anchor StickyNote to Chrome panel", icon: "layout" },
      { type: "action", id: "fake-data-generator", title: "Fake Data Generator", desc: "Insert or copy mock dataset", icon: "terminal" },
      { type: "action", id: "export-backup", title: "Export JSON Workspace", desc: "Download full files backup", icon: "download" },
      { type: "action", id: "import-backup", title: "Import JSON Workspace", desc: "Restore database from JSON", icon: "upload" },
    ];

    // Themes
    const themesOpts = themesList.map(t => ({
      type: "theme",
      id: t.id,
      title: `Switch Theme: ${t.name}`,
      desc: "Apply layout theme",
      icon: "sync"
    }));

    // Notes matching
    const notesOpts = notes
      .filter(n => !n.trash)
      .map(n => ({
        type: "note",
        id: n.id,
        title: n.title || "Untitled Note",
        desc: getSnippetPreview(n.content),
        icon: n.isTemplate ? "book-open" : "file-text"
      }));

    const allOptions = [...actions, ...notesOpts, ...themesOpts];

    // Filter
    paletteFilteredOptions = allOptions.filter(o =>
      o.title.toLowerCase().includes(query) ||
      o.desc.toLowerCase().includes(query)
    );

    if (paletteFilteredOptions.length === 0) {
      paletteEmptyState.style.display = "block";
      paletteOptionsList.style.display = "none";
      return;
    }

    paletteEmptyState.style.display = "none";
    paletteOptionsList.style.display = "flex";

    // Group items: Actions vs Notes vs Themes
    const groups = { action: [], note: [], theme: [] };
    paletteFilteredOptions.forEach(opt => groups[opt.type].push(opt));

    let indexCursor = 0;
    ["action", "note", "theme"].forEach(groupName => {
      const list = groups[groupName];
      if (list.length === 0) return;

      const groupHeader = document.createElement("div");
      groupHeader.className = "palette-group-title";
      groupHeader.textContent = groupName + "s";
      paletteOptionsList.appendChild(groupHeader);

      list.forEach(opt => {
        const itemIdx = paletteFilteredOptions.indexOf(opt);
        const itemEl = document.createElement("div");
        itemEl.className = `palette-item ${itemIdx === paletteSelectedIndex ? "selected" : ""}`;
        itemEl.dataset.index = itemIdx;

        const iconSpan = document.createElement("span");
        iconSpan.className = "palette-item-icon";
        iconSpan.innerHTML = window.lucide.get(opt.icon);

        const titleDiv = document.createElement("div");
        titleDiv.className = "palette-item-title";
        titleDiv.textContent = opt.title;

        itemEl.appendChild(iconSpan);
        itemEl.appendChild(titleDiv);

        if (opt.type === "action" && opt.id === "new-note") {
          const shortcut = document.createElement("span");
          shortcut.className = "palette-item-shortcut";
          shortcut.textContent = "Ctrl+T";
          itemEl.appendChild(shortcut);
        }

        itemEl.addEventListener("click", () => {
          executePaletteOption(opt);
        });

        paletteOptionsList.appendChild(itemEl);
      });
    });

    updatePaletteSelectionHighlight();
  }

  function updatePaletteSelectionHighlight() {
    const items = paletteOptionsList.querySelectorAll(".palette-item");
    items.forEach(el => {
      const idx = parseInt(el.getAttribute("data-index"));
      el.classList.toggle("selected", idx === paletteSelectedIndex);
      if (idx === paletteSelectedIndex) {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function executePaletteOption(opt) {
    closeCommandPalette();

    if (opt.type === "note") {
      if (!sidePanelMode) {
        showWorkspaceView(opt.id);
      } else {
        selectNote(opt.id);
      }
    } else if (opt.type === "theme") {
      settings.theme = opt.id;
      applyTheme(opt.id);
      saveSettings();
      showToast(`Applied ${opt.title}`);
    } else if (opt.type === "action") {
      switch (opt.id) {
        case "new-note":
          createNewNote();
          if (!sidePanelMode) {
            showWorkspaceView();
          }
          break;
        case "open-settings":
          openSettingsModal();
          break;
        case "open-side-panel":
          settings.sidePanelEnabled = true;
          saveSettings();
          enableSidePanelBehavior(true);
          break;
        case "fake-data-generator":
          openFakerModal();
          break;
        case "export-backup":
          triggerExportBackup();
          break;
        case "import-backup":
          settingsImportFile.click();
          break;
      }
    }
  }

  // ==========================================================================
  // DRAG & DROP NOTE REORDERING
  // ==========================================================================

  let draggedNoteId = null;

  function handleDragStart(e) {
    draggedNoteId = e.currentTarget.getAttribute("data-id");
    e.currentTarget.style.opacity = "0.4";
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedNoteId);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const overCard = e.currentTarget.closest(".note-item-card");
    if (overCard && overCard.getAttribute("data-id") !== draggedNoteId) {
      overCard.style.borderTop = "2px dashed var(--accent-color)";
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const droppedOnCard = e.currentTarget.closest(".note-item-card");
    if (!droppedOnCard) return;

    const targetNoteId = droppedOnCard.getAttribute("data-id");
    droppedOnCard.style.borderTop = "none";

    if (draggedNoteId && draggedNoteId !== targetNoteId) {
      const draggedIdx = notes.findIndex(n => n.id === draggedNoteId);
      const targetIdx = notes.findIndex(n => n.id === targetNoteId);

      // Reorder array splice
      const [draggedNote] = notes.splice(draggedIdx, 1);
      notes.splice(targetIdx, 0, draggedNote);

      // Save order
      renderNotesList();
      saveData();
      showToast("Order saved");
    }
  }

  function handleDragEnd(e) {
    e.currentTarget.style.opacity = "1";
    document.querySelectorAll(".note-item-card").forEach(c => {
      c.style.borderTop = "none";
    });
  }

  // ==========================================================================
  // RIGHT-CLICK CUSTOM CONTEXT MENU
  // ==========================================================================

  function showContextMenu(noteId, clientX, clientY) {
    rightClickedNoteId = noteId;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // Toggle contextual labels
    const pinLabel = document.getElementById("context-pin-label");
    const favLabel = document.getElementById("context-fav-label");
    const archiveLabel = document.getElementById("context-archive-label");
    const deleteLabel = document.getElementById("context-delete-label");

    if (note.trash) {
      pinLabel.parentElement.style.display = "none";
      favLabel.parentElement.style.display = "none";
      archiveLabel.parentElement.style.display = "none";
      deleteLabel.textContent = "Delete Permanently";
    } else {
      pinLabel.parentElement.style.display = "flex";
      favLabel.parentElement.style.display = "flex";
      archiveLabel.parentElement.style.display = "flex";

      pinLabel.textContent = note.pinned ? "Unpin Note" : "Pin Note";
      favLabel.textContent = note.favorite ? "Unfavorite" : "Favorite";
      archiveLabel.textContent = note.archived ? "Unarchive" : "Archive Note";
      deleteLabel.textContent = "Move to Trash";
    }

    customContextMenu.style.left = `${clientX}px`;
    customContextMenu.style.top = `${clientY}px`;
    customContextMenu.style.display = "block";
  }

  function hideContextMenu() {
    customContextMenu.style.display = "none";
  }

  document.addEventListener("click", hideContextMenu);

  // Context item actions
  document.getElementById("context-item-pin").addEventListener("click", () => {
    if (rightClickedNoteId) handleNoteHoverAction(rightClickedNoteId, "pin");
  });
  document.getElementById("context-item-favorite").addEventListener("click", () => {
    if (rightClickedNoteId) handleNoteHoverAction(rightClickedNoteId, "favorite");
  });
  document.getElementById("context-item-duplicate").addEventListener("click", () => {
    if (rightClickedNoteId) duplicateNote(rightClickedNoteId);
  });
  document.getElementById("context-item-template").addEventListener("click", () => {
    if (rightClickedNoteId) toggleNoteTemplate(rightClickedNoteId);
  });
  document.getElementById("context-item-archive").addEventListener("click", () => {
    if (rightClickedNoteId) toggleNoteArchive(rightClickedNoteId);
  });
  document.getElementById("context-item-delete").addEventListener("click", () => {
    if (rightClickedNoteId) {
      const note = notes.find(n => n.id === rightClickedNoteId);
      if (note && note.trash) {
        handleNoteHoverAction(rightClickedNoteId, "purge");
      } else {
        handleNoteHoverAction(rightClickedNoteId, "delete");
      }
    }
  });

  function duplicateNote(id) {
    const src = notes.find(n => n.id === id);
    if (!src) return;
    createNewNote(src.content, `Copy of ${src.title}`);
  }

  function toggleNoteTemplate(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.isTemplate = !note.isTemplate;
    note.modified = Date.now();
    saveData();
    renderNotesList();
    showToast(note.isTemplate ? "Saved as Template" : "Removed Template status");
  }

  function toggleNoteArchive(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.archived = !note.archived;
    note.modified = Date.now();
    saveData();
    renderNotesList();
    loadActiveNote();
    showToast(note.archived ? "Note Archived" : "Note Unarchived");
  }

  // ==========================================================================
  // FAKE DATA GENERATOR SYSTEM
  // ==========================================================================

  function openFakerModal() {
    fakerModal.classList.add("active");
    loadFakerCategory("personal");
  }

  function closeFakerModal() {
    fakerModal.classList.remove("active");
  }

  // Switch category tabs
  fakerTabs.querySelectorAll(".faker-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      fakerTabs.querySelectorAll(".faker-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const category = btn.getAttribute("data-category");
      loadFakerCategory(category);
    });
  });

  function loadFakerCategory(category) {
    // Hide all grids
    document.querySelectorAll(".faker-cards-grid").forEach(g => g.classList.remove("active"));

    const activeGrid = document.getElementById(`faker-grid-${category}`);
    activeGrid.innerHTML = "";
    activeGrid.classList.add("active");

    const fields = fakerMap[category];
    Object.keys(fields).forEach(key => {
      const field = fields[key];
      const val = field.run();

      const card = document.createElement("div");
      card.className = "faker-card";
      card.style.cursor = "pointer";

      card.innerHTML = `
        <div class="faker-card-name">${field.title}</div>
        <div class="faker-card-preview" title="${val}">${val}</div>
        <div class="faker-card-actions">
          <button class="faker-action-btn copy-btn">${window.lucide.get("copy")}<span>Copy</span></button>
          <button class="faker-action-btn insert-btn">${window.lucide.get("plus")}<span>Insert</span></button>
        </div>
      `;

      // Copy button action
      card.querySelector(".copy-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(val);
        logFakerGeneration(field.title, val);
        showToast("Copied to clipboard");
      });

      // Insert button action
      card.querySelector(".insert-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        insertTextAtCursor(val);
        logFakerGeneration(field.title, val);
        showToast(`Inserted ${field.title}`);
      });

      // Clicking the card itself inserts data
      card.addEventListener("click", () => {
        insertTextAtCursor(val);
        logFakerGeneration(field.title, val);
        showToast(`Inserted ${field.title}`);
      });

      activeGrid.appendChild(card);
    });

    window.lucide.render(activeGrid);
  }

  function logFakerGeneration(title, val) {
    let list = fakerLogsList.innerHTML;
    const cleanVal = val.length > 25 ? val.substring(0, 22) + "..." : val;
    const logItem = `
      <div class="faker-log-item">
        <span>Generated ${title}</span>
        <span class="faker-log-val">${cleanVal}</span>
      </div>
    `;
    fakerLogsList.innerHTML = logItem + list;

    // Save to storage
    chrome.storage.local.get(["fakerHistory"], (res) => {
      let history = Array.isArray(res.fakerHistory) ? res.fakerHistory : [];
      history.unshift({ title, val, time: Date.now() });
      history = history.slice(0, 20); // cap logs
      chrome.storage.local.set({ fakerHistory: history });
    });
  }

  function renderFakerLogs(history) {
    fakerLogsList.innerHTML = history.map(h => {
      const cleanVal = h.val.length > 25 ? h.val.substring(0, 22) + "..." : h.val;
      return `
        <div class="faker-log-item">
          <span>Generated ${h.title}</span>
          <span class="faker-log-val" title="${h.val}">${cleanVal}</span>
        </div>
      `;
    }).join("");
  }

  function insertTextAtCursor(text) {
    const start = noteTextarea.selectionStart;
    const end = noteTextarea.selectionEnd;
    const val = noteTextarea.value;

    noteTextarea.value = val.slice(0, start) + text + val.slice(end);
    noteTextarea.selectionStart = noteTextarea.selectionEnd = start + text.length;
    noteTextarea.focus();

    // Trigger save
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (activeNote) {
      activeNote.content = noteTextarea.value;
      activeNote.modified = Date.now();
      triggerAutosave();
      updateStats();
    }
  }

  function insertQuickFakeData() {
    if (!activeNoteId) {
      showToast("Please select a note first");
      return;
    }

    // Core details aligned consistently
    const name = generateRandomName();
    const emailName = name.toLowerCase().replace(/[^a-z0-9]/g, '.');
    const email = `${emailName}${rand(10, 999)}@` + ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"][rand(0, 4)];
    const username = emailName.replace('.', '_') + rand(10, 99);

    const company = generateRandomCompany();
    const companyDomain = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    const companyUrl = `https://www.${companyDomain}.com`;
    const personalUrl = `https://www.${emailName.replace('.', '')}.me`;

    const phone = generateRandomPhone();
    const avatar = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=150&h=150&fit=crop`;

    const job = generateRandomJob();
    const bs = generateRandomBS();
    const uuid = generateUUID();

    const ip = `${rand(1, 254)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`;
    const mac = Array.from({ length: 6 }, () => rand(0, 255).toString(16).padStart(2, '0')).join(':').toUpperCase();
    const color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    const useragent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    const card = generateCreditCard();
    const iban = "GB" + rand(10, 99) + "BARC" + rand(100000, 999999) + rand(10000000, 99999999);
    const amount = `$${rand(10, 9999)}.${rand(10, 99).toString().padStart(2, '0')}`;
    const bitcoin = "1" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const password = generatePassword(16);
    const hash = Array.from({ length: 64 }, () => rand(0, 15).toString(16)).join('');
    const apiKey = "sk_live_" + generatePassword(32);

    const street = generateRandomAddress();
    const city = generateRandomCity();
    const country = ["United States", "United Kingdom", "Canada", "Germany", "France", "Japan", "Australia", "India"][rand(0, 7)];

    const hashtag = "#" + ["productivity", "notetaking", "workspace", "minimalism", "design", "coding", "focus"][rand(0, 6)];

    const fakeData = `Mock Identity Profile

Personal Details
Full Name: ${name}
Email Address: ${email}
Phone Number: ${phone}
Avatar URL: ${avatar}

Business & Company
Company Name: ${company}
Job Title: ${job}
Website URL: ${companyUrl}
Buzzword Phrase: ${bs}
UUID v4: ${uuid}

Developer Metadata
IPv4 Address: ${ip}
MAC Address: ${mac}
Hex Color Code: ${color}
User Agent: ${useragent}

Finance Details
Credit Card: ${card}
IBAN Code: ${iban}
Currency Amount: ${amount}
BTC Wallet Address: ${bitcoin}

Security Credentials
Strong Password: ${password}
SHA-256 Hash: ${hash}
API Token Key: ${apiKey}

Location Address
Street Address: ${street}
City & Zip: ${city}
Country: ${country}

Internet Profiles
Personal Website: ${personalUrl}
Username Handle: @${username}
Trending Hashtag: ${hashtag}`;

    insertTextAtCursor(fakeData);
    showToast("Inserted Full Mock Identity Profile");
  }

  // Generator helper methods
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function generateRandomName() {
    const firsts = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
    const lasts = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Martin", "Jackson", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez"];
    return `${firsts[rand(0, firsts.length - 1)]} ${lasts[rand(0, lasts.length - 1)]}`;
  }
  function generateRandomEmail() {
    return generateRandomName().toLowerCase().replace(' ', '.') + rand(10, 999) + "@" + ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"][rand(0, 4)];
  }
  function generateRandomPhone() {
    return `(${rand(200, 999)}) ${rand(200, 999)}-${rand(1000, 9999)}`;
  }
  function generateRandomCompany() {
    const prefixes = ["Acme", "Globex", "Initech", "Umbrella", "Cyberdyne", "Soylent", "Hooli", "Veer", "Apex", "Nova"];
    const suffixes = ["Corp", "Inc", "Technologies", "Solutions", "Industries", "Global", "Systems", "Partners"];
    return `${prefixes[rand(0, prefixes.length - 1)]} ${suffixes[rand(0, suffixes.length - 1)]}`;
  }
  function generateRandomJob() {
    const levels = ["Junior", "Senior", "Lead", "Principal", "Chief", "VP of"];
    const fields = ["Software Engineer", "Product Designer", "Data Scientist", "Marketing Executive", "Product Manager", "HR Specialist", "Operations Manager"];
    return `${levels[rand(0, levels.length - 1)]} ${fields[rand(0, fields.length - 1)]}`;
  }
  function generateRandomBS() {
    const list = ["synergize out-of-the-box paradigms", "scale disruptive convergence", "leverage mission-critical deliverables", "optimize value-added schemas", "transition seamless infrastructures", "deploy next-generation mindshare"];
    return list[rand(0, list.length - 1)];
  }
  function generateCreditCard() {
    let visa = "4";
    for (let i = 0; i < 15; i++) visa += rand(0, 9);
    return visa.match(/.{1,4}/g).join(" ");
  }
  function generatePassword(len) {
    const pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    return Array.from({ length: len }, () => pool[rand(0, pool.length - 1)]).join("");
  }
  function generateRandomAddress() {
    const roads = ["Main St", "Oak Ave", "Pine Rd", "Maple Dr", "Cedar Ln", "Washington Blvd", "Broadway", "Park Lane", "Sunset Blvd"];
    return `${rand(100, 9999)} ${roads[rand(0, roads.length - 1)]}`;
  }
  function generateRandomCity() {
    const cities = ["New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ", "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Seattle, WA"];
    return `${cities[rand(0, cities.length - 1)]} ${rand(10000, 99999)}`;
  }

  // ==========================================================================
  // SETTINGS DASHBOARD SYSTEM
  // ==========================================================================

  function openSettingsModal() {
    settingsModal.classList.add("active");
    // Switch to General tab by default
    switchSettingsTab("general");
  }

  function closeSettingsModal() {
    settingsModal.classList.remove("active");
  }

  // Tab switching inside Settings
  settingsTabs.querySelectorAll(".settings-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchSettingsTab(tabId);
    });
  });

  function switchSettingsTab(tabId) {
    settingsTabs.querySelectorAll(".settings-tab-btn").forEach(b => b.classList.remove("active"));
    settingsPanes.querySelectorAll(".settings-pane").forEach(p => p.classList.remove("active"));

    const activeBtn = settingsTabs.querySelector(`[data-tab="${tabId}"]`);
    const activePane = document.getElementById(`pane-${tabId}`);

    if (activeBtn && activePane) {
      activeBtn.classList.add("active");
      activePane.classList.add("active");
    }
  }

  // Render Themes selection previews
  function renderThemesGrid() {
    themesGrid.innerHTML = "";
    themesList.forEach(t => {
      const card = document.createElement("div");
      card.className = `setting-theme-preview-card ${settings.theme === t.id ? "active" : ""}`;
      card.dataset.id = t.id;

      card.innerHTML = `
        <div class="theme-preview-visual" style="border: 1px solid var(--border-color);">
          <div class="theme-preview-visual-sidebar" style="background-color: ${t.sidebar};"></div>
          <div class="theme-preview-visual-content" style="background: ${t.primary};">
            <div class="theme-preview-visual-accent" style="background-color: ${t.accent};"></div>
          </div>
        </div>
        <div class="theme-preview-name">${t.name}</div>
      `;

      card.addEventListener("click", () => {
        themesGrid.querySelectorAll(".setting-theme-preview-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");

        if (t.id === "theme-random" && settings.theme === "theme-random") {
          randomGradient = generateRandomGradient();
          applyTheme("theme-random");
          showToast("Generated new random gradient!");
        } else {
          settings.theme = t.id;
          applyTheme(t.id);
        }
        saveSettings();
        showToast(`Theme changed to ${t.name}`);
      });

      themesGrid.appendChild(card);
    });
  }

  // Real-time Settings Bindings
  settingSidePanelToggle.addEventListener("change", () => {
    settings.sidePanelEnabled = settingSidePanelToggle.checked;
    saveSettings();
    enableSidePanelBehavior(settings.sidePanelEnabled);
    showToast(settings.sidePanelEnabled ? "Workspace (Side Panel) mode enabled" : "Popup Launcher mode restored");

    if (!settings.sidePanelEnabled) {
      if (sidePanelMode) {
        setTimeout(() => window.close(), 200);
      } else {
        body.classList.remove("side-panel-mode");
        workspaceContainer.style.display = "none";
        launcherContainer.style.display = "flex";
        closeSettingsModal();
        if (launcherSearchInput) launcherSearchInput.focus();
      }
    } else {
      if (!sidePanelMode) {
        openWorkspaceAndSelectNote();
      } else {
        body.classList.add("side-panel-mode");
        workspaceContainer.style.display = "flex";
        launcherContainer.style.display = "none";
      }
    }
  });

  settingAutosaveDelay.addEventListener("input", () => {
    const val = parseInt(settingAutosaveDelay.value) || 300;
    settings.autosaveDelay = Math.max(100, Math.min(val, 5000));
    saveSettings();
  });

  settingCustomAccent.addEventListener("input", () => {
    settings.customAccentColor = settingCustomAccent.value;
    applyCustomAccent(settings.customAccentColor);
    saveSettings();
  });

  settingResetAccent.addEventListener("click", () => {
    settings.customAccentColor = "";
    settingCustomAccent.value = "#6366f1";
    applyCustomAccent("");
    saveSettings();
    showToast("Accent color reset to theme default");
  });

  settingListModeToggle.addEventListener("change", () => {
    settings.listModeEnabled = settingListModeToggle.checked;
    saveSettings();
    showToast(settings.listModeEnabled ? "Smart lists enabled" : "Smart lists disabled");
  });

  settingEditorFont.addEventListener("change", () => {
    settings.editorFontFamily = settingEditorFont.value;
    applyEditorSettings();
    saveSettings();
  });

  settingFontSize.addEventListener("input", () => {
    const size = parseInt(settingFontSize.value) || 14;
    settings.editorFontSize = Math.max(11, Math.min(size, 24));
    applyEditorSettings();
    saveSettings();
  });

  // Database operations
  settingsExportBtn.addEventListener("click", triggerExportBackup);

  settingsImportBtn.addEventListener("click", () => {
    settingsImportFile.click();
  });

  settingsImportFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data.tabs) || Array.isArray(data.notes)) {
          const importList = Array.isArray(data.notes) ? data.notes : data.tabs;
          // Merge imported notes based on UUID
          importList.forEach(n => {
            const index = notes.findIndex(existing => existing.id === n.id || (existing.title === n.title && existing.content === n.content));
            const parsedNote = {
              id: n.id || `note_${Date.now()}_${Math.random()}`,
              title: n.title || n.name || "Imported Note",
              content: n.content || "",
              pinned: n.pinned || false,
              favorite: n.favorite || false,
              archived: n.archived || false,
              trash: n.trash || false,
              isTemplate: n.isTemplate || false,
              created: n.created || Date.now(),
              modified: n.modified || Date.now(),
            };
            if (index > -1) {
              notes[index] = parsedNote;
            } else {
              notes.push(parsedNote);
            }
          });

          // Reload UI
          renderNotesList();
          loadActiveNote();
          saveData();
          closeSettingsModal();
          showToast(`Successfully imported ${importList.length} notes`);
        } else {
          showToast("Invalid JSON file format");
        }
      } catch (err) {
        showToast("Error parsing file");
      }
    };
    reader.readAsText(file);
  });

  settingsClearBtn.addEventListener("click", () => {
    if (confirm("WARNING: This will permanently wipe ALL notes and configuration settings. Are you absolutely sure?")) {
      chrome.storage.local.clear(() => {
        notes = [];
        activeNoteId = null;
        chrome.storage.local.set({
          tabs: [],
          editorSettings: {
            sidePanelEnabled: false,
            autosaveDelay: 300,
            theme: "theme-prof-dark",
            customAccentColor: "",
            listModeEnabled: false,
            editorFontFamily: "var(--font-sans)",
            editorFontSize: 14,
          }
        }, () => {
          showToast("Storage factory reset complete");
          setTimeout(() => window.location.reload(), 1000);
        });
      });
    }
  });

  function applyTheme(themeId) {
    // Strip all current themes
    themesList.forEach(t => body.classList.remove(t.id));
    body.classList.add(themeId);

    if (themeId === "theme-random") {
      if (!randomGradient) {
        randomGradient = generateRandomGradient();
      }
      body.style.setProperty("--random-gradient", randomGradient);
      chrome.storage.local.set({ randomGradient });
    } else {
      body.style.removeProperty("--random-gradient");
    }

    // Set badge text
    const cleanName = themesList.find(t => t.id === themeId)?.name || "Dark";
    if (themeBadge) {
      themeBadge.textContent = cleanName;
    }
    if (settings.theme !== themeId) {
      settings.theme = themeId;
      saveSettings();
    }
  }

  function generateRandomGradient() {
    const colors = [
      `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
      `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
    ];
    return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
  }

  function applyCustomAccent(color) {
    if (color) {
      body.style.setProperty("--accent-color", color);
      body.style.setProperty("--accent-hover", adjustBrightness(color, -20));
      body.style.setProperty("--accent-glow", convertHexToRGB(color, 0.15));
    } else {
      body.style.removeProperty("--accent-color");
      body.style.removeProperty("--accent-hover");
      body.style.removeProperty("--accent-glow");
    }
  }

  function applyEditorSettings() {
    noteTextarea.style.fontFamily = settings.editorFontFamily;
    notePreview.style.fontFamily = settings.editorFontFamily;
    noteTextarea.style.fontSize = `${settings.editorFontSize}px`;
    notePreview.style.fontSize = `${settings.editorFontSize}px`;
  }

  // ==========================================================================
  // STORAGE & STORAGE STATS SYNC
  // ==========================================================================

  function triggerAutosave() {
    saveStatusText.textContent = "Saving...";
    saveStatusIcon.className = "lucide lucide-check sync-icon-spin";
    saveStatusIcon.innerHTML = window.lucide.get("sync");

    if (autosaveTimeout) clearTimeout(autosaveTimeout);

    autosaveTimeout = setTimeout(() => {
      saveData(() => {
        saveStatusText.textContent = "Autosaved";
        saveStatusIcon.className = "lucide lucide-check";
        saveStatusIcon.innerHTML = window.lucide.get("check");
        updateCapacityIndicator();
      });
    }, settings.autosaveDelay);
  }

  function saveData(callback = null) {
    // Maintain backwards compatibility: save tabs array
    const compatTabs = notes.map(n => {
      return {
        id: n.id,
        name: n.title, // map title to legacy name field
        title: n.title,
        content: n.content,
        pinned: n.pinned,
        favorite: n.favorite,
        archived: n.archived,
        trash: n.trash,
        isTemplate: n.isTemplate,
        created: n.created,
        modified: n.modified,
      };
    });

    chrome.storage.local.set(
      {
        tabs: compatTabs,
        activeNoteId,
        theme: settings.theme, // sync simple string fields for sidecar extensions compatibility
      },
      () => {
        if (callback) callback();
      }
    );
  }

  function saveSettings() {
    chrome.storage.local.set({ editorSettings: settings });
  }

  function enableSidePanelBehavior(enabled) {
    // Pass toggle state change parameter directly to storage triggers background worker
    chrome.storage.local.set({ sidePanelEnabled: enabled });
  }

  function updateCapacityIndicator() {
    // Crude UTF-8 byte estimate calculation
    const rawData = JSON.stringify(notes) + JSON.stringify(settings);
    const bytes = rawData.length;
    const maxBytes = 5 * 1024 * 1024; // 5MB local limit
    const pct = Math.min(100, Math.max(0, ((bytes / maxBytes) * 100)));

    if (capacityPercentage) capacityPercentage.textContent = `${pct.toFixed(2)}%`;
    if (capacityFill) capacityFill.style.width = `${pct}%`;
  }

  function triggerExportBackup() {
    const backup = {
      notes: notes,
      editorSettings: settings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stickynote_workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup file downloaded");
  }

  // ==========================================================================
  // LAUNCHER UI COMPACT POPUP LOGIC
  // ==========================================================================

  function showWorkspaceView(noteId = null) {
    if (noteId) {
      selectNote(noteId);
    }
    workspaceContainer.style.display = "flex";
    launcherContainer.style.display = "none";
    if (!sidePanelMode) {
      sidebar.classList.add("collapsed");
      sidebarCollapsed = true;
    }
  }

  function showLauncherView() {
    workspaceContainer.style.display = "none";
    launcherContainer.style.display = "flex";
    if (launcherSearchInput) launcherSearchInput.focus();
  }

  async function openWorkspaceAndSelectNote(noteId = null) {
    if (noteId) {
      await chrome.storage.local.set({ activeNoteId: noteId });
    }
    const currentWindow = await chrome.windows.getCurrent();
    try {
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      setTimeout(() => window.close(), 120);
    } catch (err) {
      // Fallback if browser panel has issues
      console.error(err);
      showToast("Toggle Side Panel setting manually");
    }
  }

  async function updateClipboardPreview() {
    try {
      // Chrome extension permissions query
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        clipboardPreviewText.textContent = text.trim();
        clipboardInsertBtn.style.display = "flex";
      } else {
        clipboardPreviewText.textContent = "Clipboard is empty";
        clipboardInsertBtn.style.display = "none";
      }
    } catch (err) {
      clipboardPreviewText.textContent = "Click to paste from clipboard";
      clipboardInsertBtn.style.display = "none";

      // Fallback click listener
      document.querySelector(".launcher-clipboard-card").addEventListener("click", async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            createNewNote(text.trim(), "Note from Clipboard");
            if (sidePanelMode) {
              openWorkspaceAndSelectNote();
            } else {
              showWorkspaceView();
            }
          }
        } catch (e) {
          showToast("Clipboard access denied");
        }
      }, { once: true });
    }
  }

  function renderLauncherRecentNotes() {
    launcherNotesList.innerHTML = "";

    // Grab top 3 recent non-trashed notes
    const recent = notes.filter(n => !n.trash).slice(0, 3);
    if (recent.length === 0) {
      launcherNotesList.innerHTML = `<div style="text-align: center; font-size: 12px; color: var(--text-tertiary); padding: 8px;">No notes found</div>`;
      return;
    }

    recent.forEach(note => {
      const row = document.createElement("div");
      row.className = "launcher-note-row";
      row.innerHTML = `
        <span class="note-item-icon" style="width: 14px; height: 14px;">${window.lucide.get(note.isTemplate ? "book-open" : "file-text")}</span>
        <span class="launcher-note-title">${note.title || "Untitled Note"}</span>
        <span class="launcher-note-date">${getRelativeTime(note.modified)}</span>
      `;
      row.addEventListener("click", () => {
        if (sidePanelMode) {
          openWorkspaceAndSelectNote(note.id);
        } else {
          showWorkspaceView(note.id);
        }
      });
      launcherNotesList.appendChild(row);
    });

    window.lucide.render(launcherNotesList);
  }

  // Bind launcher UI buttons
  if (!sidePanelMode) {
    launcherNewBtn.addEventListener("click", () => {
      createNewNote();
      showWorkspaceView();
    });
    launcherSideBtn.addEventListener("click", () => {
      openWorkspaceAndSelectNote();
    });
    launcherFakerBtn.addEventListener("click", () => {
      showWorkspaceView();
      insertQuickFakeData();
    });
    launcherSettingsBtn.addEventListener("click", () => {
      openSettingsModal();
    });
    clipboardInsertBtn.addEventListener("click", () => {
      const text = clipboardPreviewText.textContent;
      if (text && text !== "Clipboard is empty" && text !== "Click to paste from clipboard") {
        createNewNote(text, "Note from Clipboard");
        showWorkspaceView();
      }
    });

    // Launcher search triggers command palette
    launcherSearchInput.addEventListener("click", openCommandPalette);
    launcherSearchInput.addEventListener("focus", openCommandPalette);
  }

  // ==========================================================================
  // UTILITIES & NOTIFICATIONS
  // ==========================================================================

  function showToast(message, allowUndo = false) {
    const toast = document.createElement("div");
    toast.className = "toast-msg";

    const textSpan = document.createElement("span");
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (allowUndo) {
      const undoBtn = document.createElement("button");
      undoBtn.className = "toast-undo-btn";
      undoBtn.textContent = "Undo";
      undoBtn.addEventListener("click", () => {
        triggerUndoDelete();
        toast.remove();
      });
      toast.appendChild(undoBtn);
    }

    const container = document.getElementById("toast-container");
    container.appendChild(toast);

    // Auto-remove after animation completes
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  function triggerUndoDelete() {
    const note = undoDeleteStack.pop();
    if (note) {
      const existing = notes.find(n => n.id === note.id);
      if (existing) {
        existing.trash = false;
        existing.modified = Date.now();
        activeNoteId = existing.id;
      } else {
        notes.push(note);
        activeNoteId = note.id;
      }
      renderNotesList();
      loadActiveNote();
      saveData();
      showToast("Delete undone");
    }
  }

  // Color modification utility helper for hex adjustments
  function adjustBrightness(hex, percent) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = parseInt((R * (100 + percent)) / 100);
    G = parseInt((G * (100 + percent)) / 100);
    B = parseInt((B * (100 + percent)) / 100);

    R = R < 255 ? R : 255;
    G = G < 255 ? G : 255;
    B = B < 255 ? B : 255;

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  }

  function convertHexToRGB(hex, alpha) {
    const R = parseInt(hex.substring(1, 3), 16);
    const G = parseInt(hex.substring(3, 5), 16);
    const B = parseInt(hex.substring(5, 7), 16);
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }

  function updateStats() {
    const val = noteTextarea.value;
    const chars = val.length;
    const words = val.trim() ? val.trim().split(/\s+/).length : 0;

    if (charCounter) charCounter.textContent = `${chars.toLocaleString()} characters`;
    if (wordCounter) wordCounter.textContent = `${words.toLocaleString()} words`;
  }

  function updateEditorCursorPos() {
    const start = noteTextarea.selectionStart;
    const val = noteTextarea.value;
    const lines = val.substring(0, start).split("\n");
    const row = lines.length;
    const col = lines[lines.length - 1].length + 1;
    cursorCounter.textContent = `Ln ${row}, Col ${col}`;
  }

  // ==========================================================================
  // EVENT LISTENERS & TRIGGERS
  // ==========================================================================

  // Editor modifications listeners
  noteTextarea.addEventListener("input", () => {
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (activeNote) {
      activeNote.content = noteTextarea.value;
      activeNote.modified = Date.now();
      updateStats();
      triggerAutosave();
    }
  });

  noteTitleInput.addEventListener("input", () => {
    const activeNote = notes.find(n => n.id === activeNoteId);
    if (activeNote) {
      activeNote.title = noteTitleInput.value.trim() || "Untitled Note";
      activeNote.modified = Date.now();

      // Update sidebar immediately
      const cardTitle = document.querySelector(`.note-item-card[data-id="${activeNoteId}"] .note-item-title`);
      if (cardTitle) cardTitle.textContent = activeNote.title;

      triggerAutosave();
    }
  });

  noteTextarea.addEventListener("keyup", updateEditorCursorPos);
  noteTextarea.addEventListener("click", updateEditorCursorPos);

  // Auto bullet points list mode injection on Enter key down
  noteTextarea.addEventListener("keydown", (e) => {
    if (settings.listModeEnabled && e.key === "Enter") {
      const start = noteTextarea.selectionStart;
      const val = noteTextarea.value;
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const currentLine = val.slice(lineStart, start);

      // Match bullets, lists, tasks
      const match = currentLine.match(/^\s*([-•*] (?:\[ \]|\[x\])?)/);
      if (match) {
        e.preventDefault();
        const insert = "\n" + match[0];
        noteTextarea.value = val.slice(0, start) + insert + val.slice(start);
        noteTextarea.selectionStart = noteTextarea.selectionEnd = start + insert.length;

        // Trigger save
        const activeNote = notes.find(n => n.id === activeNoteId);
        if (activeNote) {
          activeNote.content = noteTextarea.value;
          activeNote.modified = Date.now();
          triggerAutosave();
          updateStats();
        }
      }
    }
  });

  // Top header action icons
  editorTogglePreview.addEventListener("click", () => {
    previewMode = !previewMode;
    loadActiveNote();
  });

  editorToggleFavorite.addEventListener("click", () => {
    if (activeNoteId) handleNoteHoverAction(activeNoteId, "favorite");
  });

  editorTogglePin.addEventListener("click", () => {
    if (activeNoteId) handleNoteHoverAction(activeNoteId, "pin");
  });

  editorMenuTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = editorMenuDropdown.style.display === "block";
    editorMenuDropdown.style.display = isVisible ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!editorMenuTrigger.contains(e.target)) {
      editorMenuDropdown.style.display = "none";
    }
  });

  // Menu action items
  menuItemDuplicate.addEventListener("click", () => {
    if (activeNoteId) duplicateNote(activeNoteId);
  });
  menuItemTemplate.addEventListener("click", () => {
    if (activeNoteId) toggleNoteTemplate(activeNoteId);
  });
  menuItemArchive.addEventListener("click", () => {
    if (activeNoteId) toggleNoteArchive(activeNoteId);
  });
  menuItemDelete.addEventListener("click", () => {
    if (activeNoteId) handleNoteHoverAction(activeNoteId, "delete");
  });

  // Sidebar collapsible triggers
  sidebarCollapseBtn.addEventListener("click", () => {
    sidebar.classList.add("collapsed");
    sidebarCollapsed = true;
  });

  sidebarExpandBtn.addEventListener("click", () => {
    sidebar.classList.remove("collapsed");
    sidebarCollapsed = false;
  });

  // Sidebar header actions
  sidebarSearchBtn.addEventListener("click", openCommandPalette);
  sidebarAddNoteBtn.addEventListener("click", () => createNewNote());
  function cycleTheme() {
    const nextIdx = (themesList.findIndex(t => t.id === settings.theme) + 1) % themesList.length;
    const nextTheme = themesList[nextIdx].id;
    settings.theme = nextTheme;
    if (nextTheme === "theme-random") {
      randomGradient = generateRandomGradient();
    }
    applyTheme(nextTheme);
    renderThemesGrid();
    saveSettings();
    showToast(`Applied ${themesList[nextIdx].name}`);
  }

  if (cycleThemeBtn) {
    cycleThemeBtn.addEventListener("click", cycleTheme);
  }
  if (sidebarSettingsBtn) {
    sidebarSettingsBtn.addEventListener("click", openSettingsModal);
  }

  const compactActionTheme = document.getElementById("compact-action-theme");
  const compactActionSettings = document.getElementById("compact-action-settings");
  if (compactActionTheme) {
    compactActionTheme.addEventListener("click", cycleTheme);
  }
  if (compactActionSettings) {
    compactActionSettings.addEventListener("click", openSettingsModal);
  }

  // Sidebar direct action click handlers
  document.getElementById("action-new-note").addEventListener("click", () => createNewNote());
  document.getElementById("action-command-palette").addEventListener("click", openCommandPalette);
  document.getElementById("action-faker").addEventListener("click", () => insertQuickFakeData());
  document.getElementById("action-theme").addEventListener("click", cycleTheme);
  document.getElementById("action-settings").addEventListener("click", openSettingsModal);
  document.getElementById("action-export").addEventListener("click", triggerExportBackup);

  // Sidebar views select buttons (strictly only folder sections containing data-section)
  document.querySelectorAll(".sidebar-section-item[data-section]").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-section-item[data-section]").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      activeSection = item.getAttribute("data-section");
      renderNotesList();

      // Select first note of this section automatically
      const visible = notes.filter(n => {
        if (activeSection === "trash") return n.trash;
        if (activeSection === "archive") return n.archived && !n.trash;
        if (n.trash || n.archived) return false;
        if (activeSection === "all") return true;
        if (activeSection === "favorites") return n.favorite;
        if (activeSection === "templates") return n.isTemplate;
        return true;
      });
      if (visible.length > 0) {
        selectNote(visible[0].id);
      } else {
        activeNoteId = null;
        hideEditorInputs(true);
      }
    });
  });

  // Modal Closures triggers
  fakerModalClose.addEventListener("click", closeFakerModal);
  settingsModalClose.addEventListener("click", closeSettingsModal);

  // Click on overlay wraps to dismiss modals
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });

  // Global Keyboard Shortcuts listener
  document.addEventListener("keydown", (e) => {
    // Esc closes active modals
    if (e.key === "Escape") {
      closeCommandPalette();
      closeFakerModal();
      closeSettingsModal();
      floatingToolbar.classList.remove("visible");
      hideContextMenu();
      return;
    }

    // Ctrl+K or '/' triggers palette (if not typing in text area)
    if (
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") ||
      (e.key === "/" && document.activeElement !== noteTextarea && document.activeElement !== noteTitleInput && document.activeElement !== launcherSearchInput && document.activeElement !== paletteSearchInput)
    ) {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    // Handle standard commands (Ctrl+S, Ctrl+T, Ctrl+Y, Ctrl+L, etc)
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveData();
        showToast("Saved manually");
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (!sidePanelMode) {
          openWorkspaceAndSelectNote();
        } else {
          createNewNote();
        }
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        cycleTheme();
      } else if (e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        insertQuickFakeData();
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        editorTogglePreview.click();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        noteTitleInput.focus();
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        triggerExportBackup();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        // Cycle active note
        const visible = notes.filter(n => !n.trash && !n.archived);
        if (visible.length > 1) {
          const idx = visible.findIndex(n => n.id === activeNoteId);
          const next = visible[(idx + 1) % visible.length];
          selectNote(next.id);
        }
      }

      // Jump 1-9 notes
      if (e.key >= "1" && e.key <= "9") {
        const visible = notes.filter(n => !n.trash && !n.archived);
        const idx = parseInt(e.key) - 1;
        if (visible[idx]) {
          e.preventDefault();
          selectNote(visible[idx].id);
        }
      }
    }
  });
});
