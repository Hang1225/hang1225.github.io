export function renderNav(activePage = '') {
  const pages = [
    { href: '/home.html', label: '首页' },
    { href: '/menu.html', label: '酒单' },
    { href: '/gallery.html', label: '相册' },
    { href: '/community.html', label: '社区' },
    { href: '/openbar.html', label: '开放吧' },
  ]

  const links = pages.map(p =>
    `<a href="${p.href}"${activePage === p.label ? ' class="active"' : ''}>${p.label}</a>`
  ).join('')

  return `<nav><a href="/home.html" class="brand">二十五</a>${links}</nav>`
}

export function renderFooter() {
  return `
    <footer>
      <span class="footer-brand">二十五 · ERSHU25</span>
      <div class="footer-links">
        <a href="https://www.facebook.com/ershu.25" target="_blank" rel="noopener">Facebook</a>
      </div>
      <span class="footer-copy">私人家庭酒吧</span>
    </footer>
  `
}
