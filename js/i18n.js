const LANG_KEY = 'hb_lang'

export function getLang() {
  return localStorage.getItem(LANG_KEY) || 'zh'
}

export function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang)
  applyLang(lang)
}

export function applyLang(lang) {
  const l = lang || getLang()
  // Text content
  document.querySelectorAll('[data-zh]').forEach(el => {
    el.textContent = l === 'zh' ? el.dataset.zh : (el.dataset.en || el.dataset.zh)
  })
  // Placeholders
  document.querySelectorAll('[data-placeholder-zh]').forEach(el => {
    el.placeholder = l === 'zh'
      ? el.dataset.placeholderZh
      : (el.dataset.placeholderEn || el.dataset.placeholderZh)
  })
  // Sync lang attribute for CSS targeting
  document.documentElement.lang = l
  // Toggle button label
  const toggle = document.getElementById('lang-toggle')
  if (toggle) toggle.textContent = l === 'zh' ? 'EN' : '中文'
}

export function t(zh, en) {
  return getLang() === 'zh' ? zh : en
}
