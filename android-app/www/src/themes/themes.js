import { readText, writeText } from '../shared/storage.js';

const THEME_KEY = 'webcoding-mobile-theme';

export const THEMES = Object.freeze({
  'cc-web': {
    label: 'cc-web',
  },
  webcoding: {
    label: 'webcoding',
  },
});

export function getStoredTheme() {
  const theme = readText(THEME_KEY, 'cc-web');
  return THEMES[theme] ? theme : 'cc-web';
}

export function applyTheme(theme) {
  const nextTheme = THEMES[theme] ? theme : 'cc-web';
  document.documentElement.dataset.theme = nextTheme;
  writeText(THEME_KEY, nextTheme);
  return nextTheme;
}
