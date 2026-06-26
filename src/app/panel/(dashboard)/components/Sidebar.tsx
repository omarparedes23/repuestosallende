'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Users,
  Building2,
  ShoppingBag,
  Truck,
  Calculator,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOutPanel } from '@/app/panel/actions/auth'
import type { LucideIcon } from 'lucide-react'

type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean }
type NavSection = { group?: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    items: [{ label: 'Dashboard', href: '/panel', icon: LayoutDashboard, exact: true }],
  },
  {
    group: 'Maestros',
    items: [
      { label: 'Artículos',    href: '/panel/articulos',   icon: Package },
      { label: 'Clientes',     href: '/panel/clientes',    icon: Users },
      { label: 'Proveedores',  href: '/panel/proveedores', icon: Building2 },
    ],
  },
  {
    group: 'Operaciones',
    items: [
      { label: 'Compras',           href: '/panel/compras', icon: ShoppingBag },
      { label: 'Guías de remisión', href: '/panel/guias',   icon: Truck },
    ],
  },
  {
    group: 'Caja',
    items: [{ label: 'Liquidación', href: '/panel/liquidacion', icon: Calculator }],
  },
]

type Props = { nombreUsuario: string }

export function Sidebar({ nombreUsuario }: Props) {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col h-screen w-60 shrink-0 border-r"
      style={{ backgroundColor: '#002D62', borderColor: '#001A3D' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: '#001A3D' }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: '#FFD700', color: '#002D62' }}
        >
          RA
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight truncate" style={{ color: '#FFFFFF' }}>
            Repuestos Allende
          </p>
          <p className="text-xs truncate" style={{ color: '#8BA7CC' }}>
            Panel admin
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map((section, idx) => (
          <div key={idx}>
            {section.group && (
              <p
                className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: '#4A6FA5' }}
              >
                {section.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ label, href, icon: Icon, exact }) => {
                const active = isActive(href, exact)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      )}
                      style={{
                        backgroundColor: active ? '#FFD700' : 'transparent',
                        color: active ? '#002D62' : '#8BA7CC',
                      }}
                    >
                      <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t" style={{ borderColor: '#001A3D' }}>
        <p className="px-3 mb-2 text-xs font-medium truncate" style={{ color: '#8BA7CC' }}>
          {nombreUsuario}
        </p>
        <form action={signOutPanel}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/10"
            style={{ color: '#8BA7CC' }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  )
}
