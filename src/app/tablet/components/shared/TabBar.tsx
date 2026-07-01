'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, Users, ClipboardList, Archive, LayoutDashboard } from 'lucide-react'

const TABS = [
  { label: 'POS', href: '/tablet/pos', icon: ShoppingCart },
  { label: 'Clientes', href: '/tablet/clientes', icon: Users },
  { label: 'Ventas', href: '/tablet/ventas', icon: ClipboardList },
  { label: 'Caja', href: '/tablet/caja', icon: Archive },
]

type Props = { rol?: string | null }

export function TabBar({ rol }: Props) {
  const pathname = usePathname()
  const tabs =
    rol === 'administrador' || rol === 'superadmin'
      ? [...TABS, { label: 'Panel', href: '/panel', icon: LayoutDashboard }]
      : TABS

  return (
    <nav
      className="flex border-t"
      style={{ backgroundColor: '#002D62', borderColor: '#001A3D' }}
    >
      {tabs.map(({ label, href, icon: Icon }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors"
            style={{
              color: isActive ? '#FFD700' : '#8BA7CC',
              backgroundColor: isActive ? '#001A3D' : 'transparent',
            }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
