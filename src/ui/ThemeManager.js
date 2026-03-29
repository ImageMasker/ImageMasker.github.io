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
