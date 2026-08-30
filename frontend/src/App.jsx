import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import ThemeToggle from './components/ThemeToggle.jsx'
import LandingPage from './pages/LandingPage.jsx'
import Layout from './components/Layout.jsx'

import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'

import Dashboard from './pages/Dashboard.jsx'
import Sales from './pages/Sales.jsx'
import Inventory from './pages/Inventory.jsx'
import Invoices from './pages/Invoices.jsx'
import Customers from './pages/Customers.jsx'

import Forecasting from './pages/Forecasting.jsx'
import Segmentation from './pages/Segmentation.jsx'
import Churn from './pages/Churn.jsx'
import Recommendations from './pages/Recommendations.jsx'
import Anomalies from './pages/Anomalies.jsx'

import Categories from './pages/Categories.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Datasets from './pages/Datasets.jsx'
import Team from './pages/Team.jsx'
import ActivityLog from './pages/ActivityLog.jsx'
import Settings from './pages/Settings.jsx'


/* =========================================================
   ROLE HELPER
========================================================= */

function getRoleName(user) {
  if (!user) {
    return ''
  }

  // Normal case:
  // user.role = "business_owner"
  if (typeof user.role === 'string') {
    return user.role
  }

  // Backend may return:
  // user.role = {
  //   id: 1,
  //   role_name: "business_owner",
  //   description: "..."
  // }
  if (user.role && typeof user.role === 'object') {
    return user.role.role_name || ''
  }

  // Another possible backend format:
  // user.role_name = "business_owner"
  if (typeof user.role_name === 'string') {
    return user.role_name
  }

  return ''
}


/* =========================================================
   PROTECTED ROUTE
========================================================= */

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Get role safely
  const roleName = getRoleName(user)

  // Check role only when allowedRoles is provided
  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(roleName)
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}


/* =========================================================
   APP
========================================================= */

export default function App() {
  const { user } = useAuth()
  const location = useLocation()

  /*
    Theme toggle is displayed separately on authentication pages.
    Layout contains the normal header ThemeToggle for protected pages.
  */
  const isPublicAuthPage = [
    '/login',
    '/register',
    '/forgot-password',
  ].includes(location.pathname)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* =====================================================
          AUTH PAGE THEME TOGGLE
      ===================================================== */}

      {isPublicAuthPage && (
        <div className="fixed top-5 right-6 z-50">
          <ThemeToggle />
        </div>
      )}


      {/* =====================================================
          ROUTES
      ===================================================== */}

      <Routes>

        {/* ===================================================
            PUBLIC LANDING PAGE
        =================================================== */}

        <Route
          path="/"
          element={<LandingPage />}
        />


        {/* ===================================================
            PUBLIC AUTH ROUTES
        =================================================== */}

        <Route
          path="/login"
          element={
            user
              ? <Navigate to="/dashboard" replace />
              : <Login />
          }
        />

        <Route
          path="/register"
          element={
            user
              ? <Navigate to="/dashboard" replace />
              : <Register />
          }
        />

        <Route
          path="/forgot-password"
          element={
            user
              ? <Navigate to="/dashboard" replace />
              : <ForgotPassword />
          }
        />


        {/* ===================================================
            PROTECTED APPLICATION ROUTES

            All pages below use Layout.

            Layout contains:
            - Sidebar
            - Header
            - Theme toggle
            - Notifications
            - Profile menu
            - Outlet
        =================================================== */}

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >

          {/* =================================================
              MAIN BUSINESS PAGES
          ================================================= */}

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/sales"
            element={<Sales />}
          />

          <Route
            path="/inventory"
            element={<Inventory />}
          />

          <Route
            path="/invoices"
            element={<Invoices />}
          />

          <Route
            path="/customers"
            element={<Customers />}
          />


          {/* =================================================
              AI / ML PAGES
          ================================================= */}

          <Route
            path="/forecasting"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'business_owner',
                  'store_manager',
                  'admin',
                ]}
              >
                <Forecasting />
              </ProtectedRoute>
            }
          />

          <Route
            path="/segmentation"
            element={<Segmentation />}
          />

          <Route
            path="/churn"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'business_owner',
                  'store_manager',
                  'admin',
                ]}
              >
                <Churn />
              </ProtectedRoute>
            }
          />

          <Route
            path="/recommendations"
            element={<Recommendations />}
          />

          <Route
            path="/anomalies"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'business_owner',
                  'store_manager',
                  'admin',
                ]}
              >
                <Anomalies />
              </ProtectedRoute>
            }
          />


          {/* =================================================
              MANAGEMENT PAGES
          ================================================= */}

          <Route
            path="/categories"
            element={<Categories />}
          />

          <Route
            path="/suppliers"
            element={<Suppliers />}
          />

          <Route
            path="/datasets"
            element={<Datasets />}
          />

          <Route
            path="/team"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'business_owner',
                  'admin',
                ]}
              >
                <Team />
              </ProtectedRoute>
            }
          />


          {/* =================================================
              ACTIVITY LOG
          ================================================= */}

          <Route
            path="/activity"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'business_owner',
                  'store_manager',
                  'admin',
                ]}
              >
                <ActivityLog />
              </ProtectedRoute>
            }
          />


          {/* =================================================
              SETTINGS
          ================================================= */}

          <Route
            path="/settings"
            element={<Settings />}
          />

        </Route>


        {/* ===================================================
            CATCH-ALL
        =================================================== */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </div>
  )
}