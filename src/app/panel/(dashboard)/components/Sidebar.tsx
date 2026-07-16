'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Users,
  Building2,
  ShoppingBag,
  ClipboardList,
  Truck,
  Calculator,
  Landmark,
  LogOut,
  Smartphone,
  Menu,
  X,
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
      { label: 'Órdenes de compra', href: '/panel/ordenes-compra', icon: ClipboardList },
      { label: 'Compras',           href: '/panel/compras',        icon: ShoppingBag },
      { label: 'Guías de remisión', href: '/panel/guias',          icon: Truck },
    ],
  },
  {
    group: 'Caja',
    items: [
      { label: 'Liquidación', href: '/panel/liquidacion', icon: Calculator },
      { label: 'Tesorería',   href: '/panel/tesoreria',   icon: Landmark },
    ],
  },
]

type Props = { nombreUsuario: string }

export function Sidebar({ nombreUsuario }: Props) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 border-b"
        style={{ backgroundColor: '#002D62', borderColor: '#001A3D' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: '#FFD700', color: '#002D62' }}
          >
            RA
          </div>
          <p className="text-sm font-bold" style={{ color: '#FFFFFF' }}>
            Panel admin
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menú"
          className="p-2 rounded-lg"
          style={{ color: '#FFFFFF' }}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'flex flex-col h-screen w-60 shrink-0 border-r fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: '#002D62', borderColor: '#001A3D' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 px-5 py-5 border-b" style={{ borderColor: '#001A3D' }}>
          <div className="flex items-center gap-3 min-w-0">
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
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar menú"
            className="md:hidden p-1 rounded-lg shrink-0"
            style={{ color: '#8BA7CC' }}
          >
            <X size={18} />
          </button>
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
          <Link
            href="/tablet/pos"
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/10"
            style={{ color: '#8BA7CC' }}
          >
            <Smartphone size={16} />
            Volver al Tablet
          </Link>
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
    </>
  )
}
