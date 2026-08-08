import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'
import ThemeToggle from './ThemeToggle'
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  FileText,
  Users,
  UsersRound,
  TrendingUp,
  PieChart,
  UserMinus,
  Sparkles,
  ShieldAlert,
  LogOut,
  Settings,
  Bell,
  ChevronDown,
  Tags,
  Truck,
  Database,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/sales', label: 'Sales', icon: ShoppingCart, roles: null },
  { to: '/inventory', label: 'Inventory', icon: Boxes, roles: null },
  { to: '/invoices', label: 'Invoices', icon: FileText, roles: null },
  { to: '/customers', label: 'Customers', icon: Users, roles: null },

  {
    to: '/team',
    label: 'Team',
    icon: UsersRound,
    roles: ['business_owner', 'admin'],
  },
  {
    to: '/categories',
    label: 'Categories',
    icon: Tags,
    roles: ['business_owner', 'store_manager', 'admin'],
  },
  {
    to: '/suppliers',
    label: 'Suppliers',
    icon: Truck,
    roles: ['business_owner', 'store_manager', 'admin'],
  },
  {
    to: '/datasets',
    label: 'Datasets',
    icon: Database,
    roles: ['business_owner', 'admin'],
  },
  {
    to: '/forecasting',
    label: 'Forecasting',
    icon: TrendingUp,
    roles: ['business_owner', 'store_manager', 'admin'],
  },
  {
    to: '/segmentation',
    label: 'Segmentation',
    icon: PieChart,
    roles: null,
  },
  {
    to: '/churn',
    label: 'Churn Risk',
    icon: UserMinus,
    roles: ['business_owner', 'store_manager', 'admin'],
  },
  {
    to: '/recommendations',
    label: 'Recommendations',
    icon: Sparkles,
    roles: null,
  },
  {
    to: '/anomalies',
    label: 'Anomaly Alerts',
    icon: ShieldAlert,
    roles: ['business_owner', 'store_manager', 'admin'],
  },
]

const ROLE_LABELS = {
  business_owner: 'Business Owner',
  store_manager: 'Store Manager',
  sales_executive: 'Sales Executive',
  admin: 'System Administrator',
}

function initials(name) {
  if (!name) return '?'

  const parts = name.trim().split(' ')

  return (
    (parts[0]?.[0] || '') +
    (parts[1]?.[0] || '')
  ).toUpperCase()
}

function NotificationBell() {
  const [alerts, setAlerts] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    api
      .get('/inventory/alerts')
      .then((res) => setAlerts(res.data))
      .catch(() => setAlerts([]))
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />

        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-white">
              Notifications
            </h3>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                No alerts right now.
              </p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300"
                >
                  {a.message || a.description || a.title}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2"
      >
        <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold">
          {initials(user?.full_name)}
        </div>

        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">
            {user?.full_name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {ROLE_LABELS[user?.role?.role_name] ||
              user?.role?.role_name ||
              'User'}
          </p>
        </div>

        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
          <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700">
            <p className="font-semibold text-slate-800 dark:text-white">
              {user?.full_name}
            </p>

            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
          </div>

          <div className="py-2">
            <button
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>

            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true

    const roleName = user?.role?.role_name

    return roleName && item.roles.includes(roleName)
  })

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-slate-900 text-white flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-xl font-bold">MarketMind AI</h1>
          <p className="text-xs text-slate-400 mt-1">
            Small Business Intelligence
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-sm font-semibold text-white">
            {user?.full_name}
          </p>

          <p className="text-xs text-slate-400 mt-1">
            {ROLE_LABELS[user?.role?.role_name] ||
              user?.role?.role_name}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end px-6 md:px-8 z-10 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              {today}
            </span>

            <ThemeToggle />

            <NotificationBell />

            <ProfileMenu
              user={user}
              onLogout={handleLogout}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}