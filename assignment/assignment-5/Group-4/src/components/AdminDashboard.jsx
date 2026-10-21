import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminShipments from '../pages/AdminShipments'
import AdminUsers from '../pages/AdminUsers'
import AdminRoutes from '../pages/AdminRoutes'
import AdminAlerts from '../pages/AdminAlerts'

function AdminDashboard({ profile, onLogout }) {
  const [page, setPage] = useState('dashboard')

  const [stats, setStats] = useState({
    shipments: 0,
    routes: 0,
    users: 0,
  })

  const [recentShipments, setRecentShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    const [
      shipmentsResult,
      routesResult,
      usersResult,
      recentShipmentsResult,
    ] = await Promise.all([
      supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true }),

      supabase
        .from('routes')
        .select('*', { count: 'exact', head: true }),

      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true }),

      supabase
        .from('shipments')
        .select(
          'id, tracking_number, origin, destination, status, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (
      shipmentsResult.error ||
      routesResult.error ||
      usersResult.error ||
      recentShipmentsResult.error
    ) {
      console.error(
        shipmentsResult.error ||
        routesResult.error ||
        usersResult.error ||
        recentShipmentsResult.error
      )

      setError('Unable to load dashboard data.')
      setLoading(false)
      return
    }

    setStats({
      shipments: shipmentsResult.count || 0,
      routes: routesResult.count || 0,
      users: usersResult.count || 0,
    })

    setRecentShipments(
      recentShipmentsResult.data || []
    )

    setLoading(false)
  }

  async function handleBackToDashboard() {
    setPage('dashboard')
    await loadDashboard()
  }

  if (page === 'shipments') {
    return (
      <AdminShipments
        onBack={handleBackToDashboard}
      />
    )
  }
  if (page === 'users') {
    return <AdminUsers onBack={handleBackToDashboard} />
  }

  if (page === 'routes') {
    return <AdminRoutes onBack={handleBackToDashboard} />
  }

  if (page === 'alerts') {
    return <AdminAlerts onBack={handleBackToDashboard} />
  }

  if (loading) {
    return <p>Loading dashboard...</p>
  }
  

  return (
    <div>
      <header>
        <h1>Admin Dashboard</h1>

        <p>Welcome, {profile.name}</p>

        <button onClick={onLogout}>
          Sign Out
        </button>
      </header>

      {error && (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <section>
        <h2>Overview</h2>

        <div>
          <div>
            <h3>Total Shipments</h3>
            <p>{stats.shipments}</p>
          </div>

          <div>
            <h3>Total Routes</h3>
            <p>{stats.routes}</p>
          </div>

          <div>
            <h3>Total Users</h3>
            <p>{stats.users}</p>
          </div>
        </div>
      </section>

      <section>
        <h2>System Management</h2>

        <button onClick={() => setPage('shipments')}>
          Manage Shipments
        </button>

        <button onClick={() => setPage('users')}>
        Manage Users
        </button>

        <button onClick={() => setPage('routes')}>
  Manage Routes
</button>

<button onClick={() => setPage('alerts')}>
  View Alerts
</button>
      </section>

      <section>
        <h2>Recent Shipments</h2>

        {recentShipments.length === 0 ? (
          <p>No shipments found.</p>
        ) : (
          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>Tracking Number</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {recentShipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>{shipment.tracking_number}</td>
                  <td>{shipment.origin}</td>
                  <td>{shipment.destination}</td>
                  <td>{shipment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default AdminDashboard