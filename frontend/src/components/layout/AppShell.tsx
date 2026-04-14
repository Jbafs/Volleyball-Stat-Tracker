import { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Users, Calendar, BarChart3, ClipboardList, LogIn, LogOut, Bell, Menu, X, Trophy, UserCog } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useLogout } from '../../api/auth'
import { api } from '../../api/client'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/seasons', label: 'Seasons', icon: Trophy },
  { to: '/matches', label: 'Matches', icon: Calendar },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const isEntryPage = location.pathname.includes('/enter/')
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fetch pending proposal count for admins
  const { data: countData } = useQuery({
    queryKey: ['proposals-count'],
    queryFn: () => api.get<{ pending: number }>('/proposals/count'),
    enabled: user?.role === 'admin',
    refetchInterval: 60_000,
  })
  const pendingCount = countData?.pending ?? 0

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/')
  }

  function handleNavClick() {
    setSidebarOpen(false)
  }

  if (isEntryPage) {
    return (
      <div className="h-screen bg-gray-950 overflow-auto">
        <Outlet />
      </div>
    )
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-white text-sm">VB Stats</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}

        {/* Admin-only section */}
        {user?.role === 'admin' && (
          <>
            <NavLink
              to="/admin/proposals"
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Bell className="w-4 h-4" />
              Proposals
              {pendingCount > 0 && (
                <span className="ml-auto text-xs bg-red-600 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {pendingCount}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/admin/users"
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <UserCog className="w-4 h-4" />
              Users
            </NavLink>
          </>
        )}
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-1">
        {user ? (
          <>
            <p className="text-xs text-gray-400 truncate px-1">{user.email}</p>
            <button
              onClick={handleLogout}
              disabled={logout.isPending}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {logout.isPending ? 'Signing out...' : 'Sign Out'}
            </button>
          </>
        ) : (
          <NavLink
            to="/login"
            onClick={handleNavClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Admin Sign In
          </NavLink>
        )}
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden sm:flex w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 sm:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="sm:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-400 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-white text-sm">VB Stats</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
