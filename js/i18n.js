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
  // Text content — for buttons, lock width to the longest translation
  document.querySelectorAll('[data-zh]').forEach(el => {
    const isBtn = el.classList.contains('btn')
    if (isBtn) {
      // Reset width so measurements are natural
      el.style.width = ''
      // Only lock width if the element is visible (skip hidden panels)
      if (el.getBoundingClientRect().width > 0) {
        // Measure both languages
        el.textContent = el.dataset.zh
        const zhW = el.getBoundingClientRect().width
        el.textContent = el.dataset.en || el.dataset.zh
        const enW = el.getBoundingClientRect().width
        // Lock to the wider of the two
        el.style.width = Math.ceil(Math.max(zhW, enW)) + 'px'
      }
      // Set the correct language text
      el.textContent = l === 'zh' ? el.dataset.zh : (el.dataset.en || el.dataset.zh)
    } else {
      el.textContent = l === 'zh' ? el.dataset.zh : (el.dataset.en || el.dataset.zh)
    }
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
