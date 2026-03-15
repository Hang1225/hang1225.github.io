import { applyLang, getLang, setLang } from './i18n.js'

export function renderNav(activePage = '') {
  const pages = [
    { href: '/home.html', label: '首页', labelEn: 'Home' },
    { href: '/menu.html', label: '酒单', labelEn: 'Menu' },
    { href: '/gallery.html', label: '相册', labelEn: 'Gallery' },
    { href: '/community.html', label: '社区', labelEn: 'Community' },
    { href: '/openbar.html', label: 'Open Bar', labelEn: 'Open Bar' },
  ]

  const links = pages.map(p =>
    `<a href="${p.href}"${activePage === p.label || activePage === p.labelEn ? ' class="active"' : ''} data-zh="${p.label}" data-en="${p.labelEn}">${p.label}</a>`
  ).join('')

  return `<nav><a href="/home.html" class="brand">二十五 · ERSHU25</a>${links}<button id="lang-toggle" class="lang-toggle">EN</button></nav>`
}

export function renderFooter() {
  return `
    <footer>
      <span class="footer-brand">二十五 · ERSHU25</span>
      <div class="footer-links">
        <a href="https://www.instagram.com/ershu.25" target="_blank" rel="noopener">Instagram</a>
      </div>
      <span class="footer-copy">Seattle · Homebar</span>
    </footer>
  `
}

export function initLang() {
  applyLang()
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    setLang(getLang() === 'zh' ? 'en' : 'zh')
  })
}
