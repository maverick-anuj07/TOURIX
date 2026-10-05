/**
 * TOURIX i18n Engine
 * Supports English, Hindi, Marathi with full UI coverage
 */
import { en } from './en.js';
import { hi } from './hi.js';
import { mr } from './mr.js';

const translations = { en, hi, mr };
let currentLang = localStorage.getItem('tourix_lang') || 'en';

/** Get the current language code */
export function getLang() {
  return currentLang;
}

/** Set language and persist */
export function setLang(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('tourix_lang', lang);
  }
}

/** Translate a key — supports dot notation: t('home.greeting') */
export function t(key, replacements = {}) {
  const keys = key.split('.');
  let value = translations[currentLang];
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations.en;
      for (const fk of keys) {
        if (value && typeof value === 'object' && fk in value) {
          value = value[fk];
        } else {
          return key; // Return key if not found
        }
      }
      break;
    }
  }

  if (typeof value !== 'string') return key;

  // Replace {{placeholders}}
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return replacements[name] !== undefined ? replacements[name] : `{{${name}}}`;
  });
}

/** Update all DOM elements with data-i18n attribute */
export function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (translated !== key) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translated;
      } else {
        el.textContent = translated;
      }
    }
  });

  // Also update data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = t(key);
    if (translated !== key) {
      el.placeholder = translated;
    }
  });
}
