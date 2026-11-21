const ACTIVE_THEME_KEY = 'imagemasker.activeTheme';
const CUSTOM_THEMES_KEY = 'imagemasker.customThemes';
const AI_EDIT_SETTINGS_KEY = 'imagemasker.aiEditSettings';
const PASTE_IMAGE_AS_LAYER_KEY = 'imagemasker.pasteImageAsLayer';
const EDITOR_SHORTCUTS_KEY = 'imagemasker.editorShortcuts';
const LEGACY_THEME_KEY = 'Night';
const POINTER_CALIBRATION_X_KEY = 'pointerCalibrationX';
const POINTER_CALIBRATION_Y_KEY = 'pointerCalibrationY';

export class Settings {
  getAccessToken() {
    return localStorage.getItem('accessToken') ?? '';
  }

  setAccessToken(token) {
    localStorage.setItem('accessToken', token);
  }

  deleteAccessToken() {
    localStorage.removeItem('accessToken');
  }

  getActiveThemeId() {
    const storedThemeId = localStorage.getItem(ACTIVE_THEME_KEY);

    if (storedThemeId) {
      return storedThemeId;
    }

    return localStorage.getItem(LEGACY_THEME_KEY) === 'true' ? 'dark' : 'light';
  }

  setActiveThemeId(themeId, isDark = themeId === 'dark') {
    localStorage.setItem(ACTIVE_THEME_KEY, themeId);
    localStorage.setItem(LEGACY_THEME_KEY, String(isDark));
  }

  getCustomThemes() {
    try {
      const themes = JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || '[]');
      return Array.isArray(themes) ? themes : [];
    } catch {
      return [];
    }
  }

  setCustomThemes(themes) {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(Array.isArray(themes) ? themes : []));
  }

  getAiEditSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(AI_EDIT_SETTINGS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  setAiEditSettings(settings) {
    localStorage.setItem(
      AI_EDIT_SETTINGS_KEY,
      JSON.stringify(settings && typeof settings === 'object' ? settings : {})
    );
  }

  getPasteImageAsLayer() {
    const stored = localStorage.getItem(PASTE_IMAGE_AS_LAYER_KEY);
    return stored === null ? true : stored !== 'false';
  }

  setPasteImageAsLayer(enabled) {
    localStorage.setItem(PASTE_IMAGE_AS_LAYER_KEY, String(enabled !== false));
  }

  getEditorShortcuts() {
    try {
      const value = JSON.parse(localStorage.getItem(EDITOR_SHORTCUTS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  setEditorShortcuts(bindings) {
    localStorage.setItem(
      EDITOR_SHORTCUTS_KEY,
      JSON.stringify(bindings && typeof bindings === 'object' ? bindings : {})
    );
  }

  clearPointerCalibration() {
    localStorage.removeItem(POINTER_CALIBRATION_X_KEY);
    localStorage.removeItem(POINTER_CALIBRATION_Y_KEY);
  }
}
