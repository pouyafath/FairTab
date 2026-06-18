export interface NavLink {
  href: string
  label: string
}

export const NAV_LINKS: NavLink[] = [
  { href: '/groups', label: 'Groups' },
  { href: '/personal', label: 'Personal' },
  { href: '/privacy', label: 'Privacy' },
]

// A link is active for its exact path or any nested route beneath it, so
// /groups/abc123 still highlights "Groups". Shared between the desktop header
// and the mobile menu so the two can't drift.
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
