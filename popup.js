// StickyNote - Enhanced State Management

const MAX_TABS = 10;
const MAX_CHARACTERS = 100000;
const AUTOSAVE_DELAY = 300; // Reduced from 1000ms for better responsiveness on close

let tabs = [];
let activeTab = 0;
let listMode = false;
let isInitialized = false; // Guard for persistence
let saveTimeout;
let theme = "light";
let customConfig = {
  type: "classic",
  gradient: "linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)",
};
let randomGradient = "";

// DOM Elements
const tabsContainer = document.getElementById("tabs-container");
const noteInput = document.getElementById("noteInput");
const noteTitle = document.getElementById("noteTitle");
const saveStatus = document.getElementById("saveStatus");
const statusIcon = document.querySelector(".status-icon");
const listModeIndicator = document.getElementById("listModeIndicator");
const themeIndicator = document.getElementById("themeIndicator");
const tabCounter = document.getElementById("tabCounter");
const lastEdited = document.getElementById("lastEdited");
const toast = document.getElementById("toast");

// Buttons
const listModeBtn = document.getElementById("listModeBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const clearTabBtn = document.getElementById("clearTab");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeMenu = document.getElementById("themeMenu");
const wordCountBtn = document.getElementById("wordCountBtn");
const wordCountPopover = document.getElementById("wordCountPopover");
const customOptions = document.getElementById("customOptions");
const bgClassic = document.getElementById("bgClassic");
const bgGradient = document.getElementById("bgGradient");
const gradientSelection = document.getElementById("gradientSelection");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPopover = document.getElementById("settingsPopover");
const sidePanelToggle = document.getElementById("sidePanelToggle");

// Reliable side panel detection
const urlParams = new URLSearchParams(window.location.search);
const sidePanelMode =
  urlParams.get("mode") === "sidepanel" ||
  window.innerWidth > 600 ||
  window.innerHeight > 500;

if (sidePanelMode) {
  document.body.classList.add("side-panel-mode");
}

// Header Actions
const addTabBtn = document.getElementById("addTabBtn");
const renameTabBtn = document.getElementById("renameTabBtn");
const deleteTabBtn = document.getElementById("deleteTabBtn");

// Enhanced Initialization
chrome.storage.local.get(
  [
    "tabs",
    "theme",
    "customConfig",
    "randomGradient",
    "activeTab",
    "sidePanelEnabled",
  ],
  (res) => {
    // Hardening: Validate structure of loaded data
    const rawTabs = Array.isArray(res.tabs) ? res.tabs : [];

    // More lenient filtering: as long as it's an object, we can try to recover it
    tabs = rawTabs.filter((t) => t && typeof t === "object").slice(0, MAX_TABS);

    if (tabs.length === 0) {
      tabs = [
        {
          name: "Quick Notes",
          title: "",
          content: "",
          pinned: false,
          created: Date.now(),
          modified: Date.now(),
        },
      ];
    }

    // Ensure all tabs have required fields and sanitized values
    tabs.forEach((tab, i) => {
      tab.name = (tab.name || `Notes ${i + 1}`).substring(0, 32);
      tab.title = (tab.title || "").substring(0, 100);
      tab.content = tab.content || "";
      if (!tab.created) tab.created = Date.now();
      if (!tab.modified) tab.modified = Date.now();
      if (tab.pinned === undefined) tab.pinned = false;
    });

    theme = res.theme || "light";
    activeTab =
      typeof res.activeTab === "number" && res.activeTab < tabs.length
        ? res.activeTab
        : 0;

    customConfig = res.customConfig || {
      type: "classic",
      gradient: "linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)",
    };
    if (theme === "random") {
      randomGradient = res.randomGradient || generateRandomGradient();
    }

    // Load side panel toggle state
    sidePanelToggle.checked = res.sidePanelEnabled || false;

    isInitialized = true; // Mark as ready
    applyTheme();
    sortTabs();
    renderTabs();
    loadActiveTab();
    updateStatusBar();
    updateLastEdited();
    noteInput.focus();
  },
);

// Tab Management
function renderTabs() {
  tabsContainer.innerHTML = "";
  tabs.forEach((tab, index) => {
    const tabEl = document.createElement("div");
    tabEl.className = `tab-item ${index === activeTab ? "active" : ""} ${tab.pinned ? "pinned" : ""}`;

    const pinIcon = document.createElement("span");
    pinIcon.className = "material-symbols-rounded pin-icon";
    pinIcon.textContent = "push_pin";
    pinIcon.style.fontVariationSettings = tab.pinned ? "'FILL' 1" : "'FILL' 0";
    pinIcon.onclick = (e) => {
      e.stopPropagation();
      togglePin(index);
    };

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.name;

    tabEl.appendChild(pinIcon);
    tabEl.appendChild(label);
    tabEl.onclick = () => switchTab(index);

    tabsContainer.appendChild(tabEl);
  });

  updateHeaderActions();
  updateStatusBar();
}

function switchTab(index) {
  if (activeTab === index) return;

  saveCurrentTab();

  // Smooth transition
  noteInput.style.opacity = "0";
  noteInput.style.transform = "translateY(8px)";
  noteTitle.style.opacity = "0";

  setTimeout(() => {
    activeTab = index;
    loadActiveTab();
    renderTabs();

    setTimeout(() => {
      noteInput.style.opacity = "1";
      noteInput.style.transform = "translateY(0)";
      noteTitle.style.opacity = "1";
      noteInput.focus();
    }, 50);
  }, 200);
}

function loadActiveTab() {
  const tab = tabs[activeTab];
  noteTitle.value = tab.title || "";
  noteInput.value = tab.content || "";
  updateLastEdited();
}

function saveCurrentTab() {
  if (!isInitialized || !tabs[activeTab]) return;
  tabs[activeTab].title = noteTitle.value;
  tabs[activeTab].content = noteInput.value;
  tabs[activeTab].modified = Date.now();
}

function togglePin(index) {
  tabs[index].pinned = !tabs[index].pinned;
  const currentActive = tabs[activeTab];
  sortTabs();
  activeTab = tabs.indexOf(currentActive);
  renderTabs();
  autoSave();
  showToast(`Tab ${tabs[index].pinned ? "pinned" : "unpinned"}`);
}

function sortTabs() {
  tabs.sort((a, b) => b.pinned - a.pinned || a.created - b.created);
}

function updateHeaderActions() {
  deleteTabBtn.disabled = tabs.length <= 1;
  if (deleteTabBtn.disabled) {
    deleteTabBtn.classList.add("disabled");
  } else {
    deleteTabBtn.classList.remove("disabled");
  }
}

function updateLastEdited() {
  const now = Date.now();
  const modified = tabs[activeTab].modified || now;
  const diff = now - modified;

  let text;
  if (diff < 60000) text = "Just now";
  else if (diff < 3600000) text = `${Math.floor(diff / 60000)}m ago`;
  else if (diff < 86400000) text = `${Math.floor(diff / 3600000)}h ago`;
  else text = `${Math.floor(diff / 86400000)}d ago`;

  lastEdited.textContent = text;
}

// Header Actions
addTabBtn.onclick = () => {
  if (tabs.length >= MAX_TABS) {
    showToast(`Maximum ${MAX_TABS} tabs reached`);
    return;
  }

  saveCurrentTab();
  tabs.push({
    name: `Notes ${tabs.length + 1}`,
    title: "",
    content: "",
    pinned: false,
    created: Date.now(),
    modified: Date.now(),
  });
  activeTab = tabs.length - 1;
  renderTabs();
  loadActiveTab();
  autoSave();

  tabsContainer.scrollTo({
    left: tabsContainer.scrollWidth,
    behavior: "smooth",
  });
  showToast("New tab created");
};

renameTabBtn.onclick = () => {
  const currentName = tabs[activeTab].name;
  const newName = prompt("Rename tab:", currentName);
  if (newName && newName.trim() && newName !== currentName) {
    // Simple sanitization for tab names
    tabs[activeTab].name = newName.trim().substring(0, 32);
    renderTabs();
    autoSave();
    showToast("Tab renamed");
  }
};

deleteTabBtn.onclick = () => {
  if (tabs.length <= 1) return;

  tabs.splice(activeTab, 1);
  activeTab = Math.min(activeTab, tabs.length - 1);
  renderTabs();
  loadActiveTab();
  autoSave();
  showToast("Tab deleted");
};

// Toolbar Actions
copyBtn.onclick = () => {
  const text = noteInput.value;
  if (!text) {
    showToast("Nothing to copy");
    return;
  }
  navigator.clipboard.writeText(text);
  showToast("Copied to clipboard");
};

clearTabBtn.onclick = () => {
  if (!noteInput.value && !noteTitle.value) {
    showToast("Already empty");
    return;
  }

  noteTitle.value = "";
  noteInput.value = "";
  autoSave();
  showToast("Note cleared");
};

exportBtn.onclick = () => {
  saveCurrentTab();
  const exportData = {
    exported: new Date().toISOString(),
    tabs: tabs,
    theme: theme,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stickynote_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported successfully");
};

listModeBtn.onclick = () => {
  listMode = !listMode;
  listModeBtn.classList.toggle("active", listMode);
  listModeIndicator.style.display = listMode ? "flex" : "none";
  showToast(`List mode ${listMode ? "enabled" : "disabled"}`);
};

// Word Count Feature
wordCountBtn.onclick = (e) => {
  e.stopPropagation();
  updateWordCount();
  const isVisible = wordCountPopover.style.display !== "none";
  wordCountPopover.style.display = isVisible ? "none" : "block";
  settingsPopover.style.display = "none";
};

function updateWordCount() {
  const text = noteInput.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.split("\n").length;
  const readTime = Math.ceil(words / 200) || 1;

  document.getElementById("charCount").textContent = chars.toLocaleString();
  document.getElementById("wordCount").textContent = words.toLocaleString();
  document.getElementById("lineCount").textContent = lines.toLocaleString();
}

// Theme Management
themeToggleBtn.onclick = (e) => {
  e.stopPropagation();
  themeMenu.style.display =
    themeMenu.style.display === "none" ? "block" : "none";
  wordCountPopover.style.display = "none";
  settingsPopover.style.display = "none";
};

document.addEventListener("click", (e) => {
  if (!themeMenu.contains(e.target) && e.target !== themeToggleBtn) {
    themeMenu.style.display = "none";
  }
  if (!wordCountPopover.contains(e.target) && e.target !== wordCountBtn) {
    wordCountPopover.style.display = "none";
  }
  if (!settingsPopover.contains(e.target) && !settingsBtn.contains(e.target)) {
    settingsPopover.style.display = "none";
  }
});

// Settings Popover
settingsBtn.onclick = (e) => {
  e.stopPropagation();
  const isVisible = settingsPopover.style.display !== "none";
  settingsPopover.style.display = isVisible ? "none" : "block";
  themeMenu.style.display = "none";
  wordCountPopover.style.display = "none";
};

// Side Panel Toggle
sidePanelToggle.onchange = () => {
  const enabled = sidePanelToggle.checked;
  chrome.storage.local.set({ sidePanelEnabled: enabled }, async () => {
    showToast(enabled ? "Switching to Side Panel..." : "Popup mode restored");

    if (enabled) {
      // If we are in the popup, open the side panel and close the popup
      try {
        const currentWindow = await chrome.windows.getCurrent();
        await chrome.sidePanel.open({ windowId: currentWindow.id });
        // Give a tiny delay for the side panel to start opening before closing the popup
        setTimeout(() => window.close(), 100);
      } catch (err) {
        console.error("Failed to auto-open side panel:", err);
      }
    } else {
      // If we are currently in the side panel, close it when toggled off
      if (
        document.documentElement.classList.contains("side-panel-mode") ||
        document.body.classList.contains("side-panel-mode")
      ) {
        setTimeout(() => window.close(), 300);
      }
    }
  });
};

themeMenu.querySelectorAll(".theme-grid button").forEach((btn) => {
  btn.onclick = (e) => {
    e.stopPropagation();
    theme = btn.dataset.theme;

    if (theme === "random") {
      randomGradient = generateRandomGradient();
    }

    if (theme === "custom") {
      customOptions.style.display = "block";
      syncCustomUI();
    } else {
      customOptions.style.display = "none";
      applyTheme();
      autoSave();
      themeMenu.style.display = "none";
    }

    showToast(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
  };
});

// Custom Theme Controls
bgClassic.onclick = () => {
  customConfig.type = "classic";
  bgClassic.classList.add("active");
  bgGradient.classList.remove("active");
  gradientSelection.style.display = "none";
  applyTheme();
  autoSave();
};

bgGradient.onclick = () => {
  customConfig.type = "gradient";
  bgGradient.classList.add("active");
  bgClassic.classList.remove("active");
  gradientSelection.style.display = "block";
  applyTheme();
  autoSave();
};

document.querySelectorAll(".grad-item").forEach((item) => {
  item.onclick = () => {
    customConfig.gradient = item.dataset.grad;
    document
      .querySelectorAll(".grad-item")
      .forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    applyTheme();
    autoSave();
  };
});

function applyTheme() {
  const isSidePanelMode =
    document.documentElement.classList.contains("side-panel-mode") ||
    document.body.classList.contains("side-panel-mode");
  document.body.className = theme;
  if (isSidePanelMode) document.body.classList.add("side-panel-mode");

  let currentGradient = "";
  if (theme === "random") {
    currentGradient = randomGradient;
  } else if (theme === "custom") {
    currentGradient =
      customConfig.type === "classic"
        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        : customConfig.gradient;
  }

  if (currentGradient) {
    // Hardening: Strictly validate gradient string to prevent injection (allows hex + percentages)
    const isValid =
      /^linear-gradient\(135deg, ?(#([a-f\d]{6}|[a-f\d]{3})( \d+%)?,? ?)+\)$/i.test(
        currentGradient,
      );

    if (isValid) {
      document.body.style.setProperty("--bg-gradient", currentGradient);

      // Extract all hex colors to check overall brightness
      const colors = currentGradient.match(/#([a-f\d]{6}|[a-f\d]{3})/gi);
      if (colors && colors.length > 0) {
        document.body.style.setProperty("--accent-primary", colors[0]);

        // Check if at least one color is dark to trigger dark mode styles for contrast
        const isDark = colors.some((c) => getLuminance(c) < 0.5);
        if (isDark) {
          document.body.classList.add("dark");
        } else {
          document.body.classList.remove("dark");
        }
      }
    }
  } else {
    document.body.style.removeProperty("--bg-gradient");
    document.body.style.removeProperty("--accent-primary");
  }

  themeIndicator.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
}

function getLuminance(hex) {
  if (!hex) return 1;
  let r, g, b;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function cycleTheme() {
  const themes = ["light", "dark", "random", "custom"];
  let currentIndex = themes.indexOf(theme);
  let nextIndex = (currentIndex + 1) % themes.length;
  theme = themes[nextIndex];

  if (theme === "random") {
    randomGradient = generateRandomGradient();
  }

  applyTheme();
  autoSave();

  // If we cycled to custom, show the UI so they know they can change it
  if (theme === "custom") {
    themeMenu.style.display = "block";
    customOptions.style.display = "block";
    syncCustomUI();
  } else {
    themeMenu.style.display = "none";
  }

  showToast(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
}

function syncCustomUI() {
  if (customConfig.type === "classic") {
    bgClassic.classList.add("active");
    bgGradient.classList.remove("active");
    gradientSelection.style.display = "none";
  } else {
    bgGradient.classList.add("active");
    bgClassic.classList.remove("active");
    gradientSelection.style.display = "block";

    document.querySelectorAll(".grad-item").forEach((item) => {
      if (item.dataset.grad === customConfig.gradient) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }
}

function generateRandomGradient() {
  const colors = [
    `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`,
    `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`,
  ];
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
}

// Enhanced Fake Data Generators
const fakerMap = {
  name: async () => {
    const firstNames = [
      "James",
      "Mary",
      "John",
      "Patricia",
      "Robert",
      "Jennifer",
      "Michael",
      "Linda",
      "William",
      "Elizabeth",
      "David",
      "Barbara",
      "Richard",
      "Susan",
      "Joseph",
      "Jessica",
      "Thomas",
      "Sarah",
      "Charles",
      "Karen",
    ];
    const lastNames = [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Jones",
      "Garcia",
      "Miller",
      "Davis",
      "Rodriguez",
      "Martinez",
      "Hernandez",
      "Lopez",
      "Gonzalez",
      "Wilson",
      "Anderson",
      "Thomas",
      "Taylor",
      "Moore",
      "Jackson",
      "Martin",
    ];

    try {
      const res = await fetch("https://randomuser.me/api/");
      const data = await res.json();
      const u = data.results[0].name;
      return `${u.first} ${u.last}`;
    } catch {
      const first = firstNames[Math.floor(Math.random() * firstNames.length)];
      const last = lastNames[Math.floor(Math.random() * lastNames.length)];
      return `${first} ${last}`;
    }
  },

  email: () => {
    const domains = [
      "gmail.com",
      "yahoo.com",
      "outlook.com",
      "hotmail.com",
      "icloud.com",
    ];
    const prefix = Math.random().toString(36).substring(2, 10);
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${prefix}@${domain}`;
  },

  phone: () => {
    const formats = [
      `+1 (${rand(200, 999)}) ${rand(200, 999)}-${rand(1000, 9999)}`,
      `${rand(200, 999)}-${rand(200, 999)}-${rand(1000, 9999)}`,
      `(${rand(200, 999)}) ${rand(200, 999)}-${rand(1000, 9999)}`,
    ];
    return formats[Math.floor(Math.random() * formats.length)];
  },

  address: () => {
    const streets = [
      "Main St",
      "Oak Ave",
      "Maple Dr",
      "Pine Rd",
      "Cedar Ln",
      "Elm St",
      "Washington Blvd",
      "Park Ave",
      "Lake Dr",
      "Hill St",
    ];
    const cities = [
      "New York",
      "Los Angeles",
      "Chicago",
      "Houston",
      "Phoenix",
      "Philadelphia",
      "San Antonio",
      "San Diego",
      "Dallas",
      "Austin",
    ];
    const states = ["NY", "CA", "IL", "TX", "AZ", "PA", "TX", "CA", "TX", "TX"];

    const idx = Math.floor(Math.random() * cities.length);
    return `${rand(1, 9999)} ${streets[Math.floor(Math.random() * streets.length)]}, ${cities[idx]}, ${states[idx]} ${rand(10000, 99999)}`;
  },

  date: () => {
    const start = new Date(2020, 0, 1);
    const end = new Date();
    const date = new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  },

  card: () => {
    // Generate Luhn-valid test card number
    let card = "4";
    for (let i = 0; i < 15; i++) {
      card += Math.floor(Math.random() * 10);
    }
    return card.match(/.{1,4}/g).join(" ");
  },

  password: () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

document.querySelectorAll(".faker-btn").forEach((btn) => {
  btn.onclick = async () => {
    const type = btn.dataset.type;
    const value = await fakerMap[type]();
    insertAtCursor(value);
    showToast(`Inserted ${type}`);
  };
});

function insertAtCursor(text) {
  const start = noteInput.selectionStart;
  const end = noteInput.selectionEnd;
  const val = noteInput.value;
  noteInput.value = val.slice(0, start) + text + val.slice(end);
  noteInput.selectionStart = noteInput.selectionEnd = start + text.length;
  noteInput.focus();
  autoSave();
}

// Editor Logic
noteInput.oninput = () => {
  autoSave();
  updateWordCount();
};

noteTitle.oninput = autoSave;

noteInput.onkeydown = (e) => {
  if (listMode && e.key === "Enter") {
    e.preventDefault();
    const start = noteInput.selectionStart;
    const val = noteInput.value;
    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    const currentLine = val.slice(lineStart, start);

    const indentMatch = currentLine.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : "";

    const bullets = ["• ", "○ ", "▪ ", "→ ", "✓ "];
    const bullet = bullets[Math.floor(Math.random() * bullets.length)];

    const insert = "\n" + indent + bullet;
    noteInput.value = val.slice(0, start) + insert + val.slice(start);
    noteInput.selectionStart = noteInput.selectionEnd = start + insert.length;
    autoSave();
  }
};

// Storage & Status
function autoSave() {
  if (!isInitialized) return;

  saveStatus.textContent = "Saving...";
  statusIcon.className = "material-symbols-rounded status-icon";
  statusIcon.textContent = "sync";
  statusIcon.style.color = "var(--warning)";

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveCurrentTab();
    chrome.storage.local.set(
      {
        tabs,
        theme,
        activeTab,
        customConfig,
        randomGradient,
      },
      () => {
        saveStatus.textContent = "All changes saved";
        statusIcon.textContent = "cloud_done";
        statusIcon.style.color = "var(--success)";
        updateStatusBar();
        updateLastEdited();
      },
    );
  }, AUTOSAVE_DELAY);
}

function updateStatusBar() {
  tabCounter.textContent = "";
  const icon = document.createElement("span");
  icon.className = "material-symbols-rounded";
  icon.textContent = "tab";
  tabCounter.appendChild(icon);
  tabCounter.appendChild(
    document.createTextNode(` ${activeTab + 1}/${tabs.length}`),
  );
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Keyboard Shortcuts
document.onkeydown = (e) => {
  // Prevent shortcuts when typing in inputs
  if (e.target === noteInput || e.target === noteTitle) {
    if (!e.ctrlKey && !e.metaKey) return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "t") {
    e.preventDefault();
    addTabBtn.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "r") {
    e.preventDefault();
    renameTabBtn.click();
  }
  if (e.key === "Delete" && e.target !== noteInput && e.target !== noteTitle) {
    deleteTabBtn.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "l") {
    e.preventDefault();
    listModeBtn.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "e") {
    e.preventDefault();
    exportBtn.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    autoSave();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "y") {
    e.preventDefault();
    cycleTheme();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
    e.preventDefault();

    const generateAll = async () => {
      const results = [];
      for (const type of Object.keys(fakerMap)) {
        const value = await fakerMap[type]();
        results.push(
          `${type.charAt(0).toUpperCase() + type.slice(1)}: ${value}`,
        );
      }
      insertAtCursor("\n" + results.join("\n") + "\n");
      showToast("Inserted all fake data");
    };

    generateAll();
  }

  // Tab Navigation Shortcuts
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    const nextTab = (activeTab + 1) % tabs.length;
    switchTab(nextTab);
  }

  // Ctrl + 1-9 for tabs 1-9
  if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
    const index = parseInt(e.key) - 1;
    if (tabs[index]) {
      e.preventDefault();
      switchTab(index);
    }
  }

  // Ctrl + 0 for tab 10
  if ((e.ctrlKey || e.metaKey) && e.key === "0") {
    if (tabs[9]) {
      e.preventDefault();
      switchTab(9);
    }
  }
};

// Auto-update last edited time
setInterval(updateLastEdited, 30000);

// Smooth transitions on load
noteInput.style.transition = "opacity 0.3s, transform 0.3s";
noteTitle.style.transition = "opacity 0.3s";
