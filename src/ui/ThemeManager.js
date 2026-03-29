const BUILTIN_THEMES = [
  {
    id: 'light',
    name: 'Classic Light',
    builtin: true,
    base: 'light',
    vars: {},
    layout: {},
    cssText: '',
  },
  {
    id: 'dark',
    name: 'Midnight Blue',
    builtin: true,
    base: 'dark',
    vars: {},
    layout: {},
    cssText: '',
  },
  {
    id: 'claude-light',
    name: 'Claude Light',
    builtin: true,
    base: 'light',
    vars: {
      '--bg-primary': 'rgb(247, 243, 236)',
      '--bg-panel': 'rgb(241, 233, 221)',
      '--bg-button': 'rgb(226, 213, 194)',
      '--bg-button-hover': 'rgb(216, 201, 180)',
      '--bg-input': 'rgb(235, 226, 214)',
      '--bg-slider': 'rgb(231, 222, 209)',
      '--bg-slider-thumb': 'rgb(201, 143, 87)',
      '--bg-upload-label': 'rgb(239, 231, 220)',
      '--bg-upload-label-hover': 'rgb(228, 216, 200)',
      '--bg-nav-button': 'rgb(224, 196, 155)',
      '--bg-saved-rounds-button': 'rgb(237, 228, 216)',
      '--bg-saved-rounds-button-hover': 'rgb(225, 212, 194)',
      '--bg-country-select': 'rgb(235, 227, 215)',
      '--bg-night-button': 'rgb(236, 228, 216)',
      '--bg-night-button-hover': 'rgb(226, 215, 199)',
      '--bg-overlay': 'rgba(45, 35, 24, 0.18)',
      '--bg-success': 'rgb(122, 157, 113)',
      '--bg-warning': 'rgb(193, 142, 79)',
      '--bg-error': 'rgb(180, 96, 89)',
      '--text-primary': 'rgb(43, 37, 32)',
      '--text-muted': 'rgba(43, 37, 32, 0.68)',
      '--text-button': 'rgb(43, 37, 32)',
      '--text-placeholder': 'rgb(129, 118, 104)',
      '--border-fieldset': 'rgba(111, 92, 66, 0.5)',
      '--border-strong': 'rgba(89, 73, 51, 0.14)',
      '--slider-hover': 'rgb(226, 215, 199)',
      '--shadow-soft': '0 18px 42px rgba(68, 50, 30, 0.08)',
      '--focus-ring': 'rgba(201, 143, 87, 0.55)',
    },
    layout: {},
    cssText: `
      body {
        background:
          radial-gradient(circle at top left, rgba(214, 185, 143, 0.16), transparent 34%),
          linear-gradient(180deg, rgb(250, 247, 242) 0%, rgb(245, 240, 232) 100%);
      }

      .panel-fieldset,
      .settings-modal {
        border-radius: 18px;
      }

      .tool-section,
      .panel-inline-message,
      .panel-empty-state,
      .settings-tab-list {
        background: rgba(255, 252, 247, 0.52);
      }

      .app-button,
      #settingsButton,
      #github,
      .settings-tab-button {
        border-radius: 999px;
      }
    `,
  },
  {
    id: 'claude-dark',
    name: 'Claude Dark',
    builtin: true,
    base: 'dark',
    vars: {
      '--bg-primary': 'rgb(40, 38, 34)',
      '--bg-panel': 'rgb(52, 49, 45)',
      '--bg-button': 'rgb(66, 61, 54)',
      '--bg-button-hover': 'rgb(80, 74, 66)',
      '--bg-input': 'rgb(60, 56, 50)',
      '--bg-slider': 'rgb(67, 62, 55)',
      '--bg-slider-thumb': 'rgb(208, 154, 96)',
      '--bg-upload-label': 'rgb(58, 54, 48)',
      '--bg-upload-label-hover': 'rgb(72, 67, 60)',
      '--bg-nav-button': 'rgb(88, 67, 46)',
      '--bg-saved-rounds-button': 'rgb(56, 52, 47)',
      '--bg-saved-rounds-button-hover': 'rgb(70, 65, 58)',
      '--bg-country-select': 'rgb(58, 54, 48)',
      '--bg-night-button': 'rgb(60, 56, 50)',
      '--bg-night-button-hover': 'rgb(74, 69, 61)',
      '--bg-overlay': 'rgba(10, 10, 9, 0.5)',
      '--bg-success': 'rgb(96, 136, 101)',
      '--bg-warning': 'rgb(180, 130, 76)',
      '--bg-error': 'rgb(163, 92, 84)',
      '--text-primary': 'rgb(244, 237, 227)',
      '--text-muted': 'rgba(244, 237, 227, 0.68)',
      '--text-button': 'rgb(244, 237, 227)',
      '--text-placeholder': 'rgb(167, 156, 143)',
      '--border-fieldset': 'rgba(230, 214, 191, 0.22)',
      '--border-strong': 'rgba(255, 244, 228, 0.12)',
      '--slider-hover': 'rgb(81, 75, 67)',
      '--shadow-soft': '0 18px 42px rgba(0, 0, 0, 0.28)',
      '--focus-ring': 'rgba(220, 171, 118, 0.62)',
    },
    layout: {},
    cssText: `
      body {
        background:
          radial-gradient(circle at top left, rgba(130, 97, 62, 0.16), transparent 30%),
          linear-gradient(180deg, rgb(42, 40, 36) 0%, rgb(36, 34, 30) 100%);
      }

      .panel-fieldset,
      .settings-modal {
        border-radius: 18px;
      }

      :root.dark .tool-section,
      :root.dark .panel-inline-message,
      :root.dark .panel-empty-state,
      :root.dark .settings-tab-list {
        background: rgba(255, 248, 238, 0.05);
      }

      .app-button,
      #settingsButton,
      #github,
      .settings-tab-button {
        border-radius: 999px;
      }
    `,
  },
];

const ALLOWED_LAYOUT_COLUMNS = new Set(['default', 'mirrored']);
const ALLOWED_LAYOUT_CHROME = new Set(['top-right', 'top-left', 'bottom-right', 'bottom-left']);

function slugifyThemeName(name) {
  return String(name || 'custom-theme')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'custom-theme';
}

function normalizeVars(vars) {
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(vars)
      .filter(([key, value]) => key.startsWith('--') && typeof value === 'string' && value.trim())
      .map(([key, value]) => [key, value.trim()])
  );
}

function normalizeLayout(layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    return {};
  }

  const normalized = {};

  if (ALLOWED_LAYOUT_COLUMNS.has(layout.columns)) {
    normalized.columns = layout.columns;
  }

  if (ALLOWED_LAYOUT_CHROME.has(layout.chrome)) {
    normalized.chrome = layout.chrome;
  }

  if (typeof layout.toolbarWidth === 'string' && layout.toolbarWidth.trim()) {
    normalized.toolbarWidth = layout.toolbarWidth.trim();
  }

  if (typeof layout.inspectorWidth === 'string' && layout.inspectorWidth.trim()) {
    normalized.inspectorWidth = layout.inspectorWidth.trim();
  }

  return normalized;
}

function normalizeThemeDefinition(theme, fallbackName = 'Custom theme') {
  const name = typeof theme?.name === 'string' && theme.name.trim()
    ? theme.name.trim()
    : fallbackName;

  return {
    id: typeof theme?.id === 'string' && theme.id.trim() ? theme.id.trim() : '',
    name,
    builtin: false,
    base: theme?.base === 'dark' ? 'dark' : 'light',
    vars: normalizeVars(theme?.vars),
    layout: normalizeLayout(theme?.layout),
    cssText: typeof theme?.cssText === 'string' ? theme.cssText.trim() : '',
  };
}

export class ThemeManager {
  constructor(settings) {
    this.settings = settings;
    this.appShell = null;
    this.customThemes = [];
    this.activeThemeId = 'light';
    this.appliedVarNames = new Set();
    this.customCssElement = null;
  }

  init(appShell) {
    this.appShell = appShell;
    this.customThemes = this.loadCustomThemes();
    this.activeThemeId = this.resolveInitialThemeId();
    this.ensureCustomCssElement();
    this.applyTheme(this.activeThemeId);
  }

  getThemes() {
    return [...BUILTIN_THEMES, ...this.customThemes];
  }

  getActiveThemeId() {
    return this.activeThemeId;
  }

  getActiveTheme() {
    return this.getThemeById(this.activeThemeId) ?? BUILTIN_THEMES[0];
  }

  getThemeById(themeId) {
    return this.getThemes().find((theme) => theme.id === themeId) ?? null;
  }

  applyTheme(themeId) {
    const theme = this.getThemeById(themeId) ?? BUILTIN_THEMES[0];

    this.activeThemeId = theme.id;
    this.settings.setActiveThemeId(theme.id, theme.base === 'dark');
    document.documentElement.classList.toggle('dark', theme.base === 'dark');
    this.applyVars(theme.vars);
    this.applyLayout(theme.layout);
    this.applyCustomCss(theme.cssText);

    return theme;
  }

  importTheme(rawTheme, fallbackName = 'Imported theme') {
    const normalizedTheme = normalizeThemeDefinition(rawTheme, fallbackName);
    const baseId = normalizedTheme.id || slugifyThemeName(normalizedTheme.name);
    const existingIds = new Set(this.getThemes().map((theme) => theme.id));
    let nextId = baseId;
    let suffix = 2;

    while (existingIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const themeRecord = {
      ...normalizedTheme,
      id: nextId,
    };

    this.customThemes = [...this.customThemes, themeRecord];
    this.settings.setCustomThemes(this.customThemes);
    this.applyTheme(themeRecord.id);
    return themeRecord;
  }

  deleteTheme(themeId) {
    const theme = this.getThemeById(themeId);

    if (!theme || theme.builtin) {
      return false;
    }

    this.customThemes = this.customThemes.filter((entry) => entry.id !== themeId);
    this.settings.setCustomThemes(this.customThemes);

    if (this.activeThemeId === themeId) {
      this.applyTheme('light');
    }

    return true;
  }

  exportTheme(themeId = this.activeThemeId) {
    const theme = this.getThemeById(themeId);

    if (!theme) {
      return null;
    }

    return {
      name: theme.name,
      base: theme.base,
      vars: { ...theme.vars },
      layout: { ...theme.layout },
      cssText: theme.cssText,
    };
  }

  describeTheme(themeId = this.activeThemeId) {
    const theme = this.getThemeById(themeId);

    if (!theme) {
      return '';
    }

    const layoutBits = [];

    if (theme.layout.columns === 'mirrored') {
      layoutBits.push('mirrored side panels');
    }

    if (theme.layout.chrome) {
      layoutBits.push(`controls at ${theme.layout.chrome}`);
    }

    if (theme.cssText) {
      layoutBits.push('custom CSS enabled');
    }

    const summary = layoutBits.length ? layoutBits.join(', ') : 'default layout';
    return `${theme.name} uses the ${theme.base} base with ${Object.keys(theme.vars).length} custom variables and ${summary}.`;
  }

  loadCustomThemes() {
    const usedIds = new Set(BUILTIN_THEMES.map((theme) => theme.id));

    return this.settings
      .getCustomThemes()
      .map((theme, index) => normalizeThemeDefinition(theme, `Custom theme ${index + 1}`))
      .map((theme, index) => {
        const baseId = theme.id || `custom-theme-${index + 1}`;
        let nextId = baseId;
        let suffix = 2;

        while (usedIds.has(nextId)) {
          nextId = `${baseId}-${suffix}`;
          suffix += 1;
        }

        usedIds.add(nextId);

        return {
          ...theme,
          id: nextId,
        };
      });
  }

  resolveInitialThemeId() {
    const preferredThemeId = this.settings.getActiveThemeId();
    return this.getThemeById(preferredThemeId) ? preferredThemeId : 'light';
  }

  ensureCustomCssElement() {
    if (this.customCssElement) {
      return;
    }

    this.customCssElement = document.createElement('style');
    this.customCssElement.id = 'customThemeStyles';
    document.head.appendChild(this.customCssElement);
  }

  applyVars(vars) {
    for (const varName of this.appliedVarNames) {
      document.documentElement.style.removeProperty(varName);
    }

    this.appliedVarNames.clear();

    for (const [varName, value] of Object.entries(vars ?? {})) {
      document.documentElement.style.setProperty(varName, value);
      this.appliedVarNames.add(varName);
    }
  }

  applyLayout(layout = {}) {
    if (!this.appShell) {
      return;
    }

    this.appShell.dataset.layoutColumns = layout.columns === 'mirrored' ? 'mirrored' : 'default';
    this.appShell.dataset.chromePosition = ALLOWED_LAYOUT_CHROME.has(layout.chrome)
      ? layout.chrome
      : 'top-right';

    if (layout.toolbarWidth) {
      this.appShell.style.setProperty('--tools-column-width', layout.toolbarWidth);
    } else {
      this.appShell.style.removeProperty('--tools-column-width');
    }

    if (layout.inspectorWidth) {
      this.appShell.style.setProperty('--masks-column-width', layout.inspectorWidth);
    } else {
      this.appShell.style.removeProperty('--masks-column-width');
    }
  }

  applyCustomCss(cssText = '') {
    if (!this.customCssElement) {
      return;
    }

    this.customCssElement.textContent = cssText;
  }
}
