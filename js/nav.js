export function renderNav(activePage = '') {
  const pages = [
    { href: '/home.html', label: 'Home' },
    { href: '/menu.html', label: 'Menu' },
    { href: '/gallery.html', label: 'Gallery' },
    { href: '/community.html', label: 'Community' },
    { href: '/openbar.html', label: 'OpenBar' },
  ]

  const links = pages.map(p =>
    `<a href="${p.href}" ${activePage === p.label ? 'style="color:var(--text)"' : ''}>${p.label}</a>`
  ).join('')

  return `<nav><span class="brand">The Homebar</span>${links}</nav>`
}
