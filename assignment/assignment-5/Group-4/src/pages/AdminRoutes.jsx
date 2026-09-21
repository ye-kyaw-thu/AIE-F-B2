import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function AdminRoutes({ onBack }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [drivers, setDrivers] = useState([])

  useEffect(() => {
    loadRoutes()
  }, [])

  async function loadRoutes() {
    setLoading(true)
    setError('')
  
    // Get routes
    const { data: routeData, error: routeError } =
      await supabase
        .from('routes')
        .select(
          'id, name, origin, destination, status, description, updated_at'
        )
        .order('name')
  
    if (routeError) {
      console.error('Routes error:', routeError)
      setError(routeError.message)
      setLoading(false)
      return
    }
  
    // Get shipments with driver assignments
    const { data: shipmentData, error: shipmentError } =
      await supabase
        .from('shipments')
        .select('route_id, driver_id')
  
    if (shipmentError) {
      console.error('Shipments error:', shipmentError)
      setError(shipmentError.message)
      setLoading(false)
      return
    }
  
    // Get all drivers
    const { data: driverData, error: driverError } =
      await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'DRIVER')
        .order('name')
  
    if (driverError) {
      console.error('Drivers error:', driverError)
      setError(driverError.message)
      setLoading(false)
      return
    }
  
    // Map drivers to each route
    const routesWithDrivers = (routeData || []).map(
      (route) => {
        const routeDriverIds = [
          ...new Set(
            (shipmentData || [])
              .filter(
                (shipment) =>
                  shipment.route_id === route.id &&
                  shipment.driver_id
              )
              .map(
                (shipment) => shipment.driver_id
              )
          ),
        ]
  
        const routeDrivers = (driverData || []).filter(
          (driver) =>
            routeDriverIds.includes(driver.id)
        )
  
        return {
          ...route,
          drivers: routeDrivers,
        }
      }
    )
  
    setRoutes(routesWithDrivers)
    setDrivers(driverData || [])
    setLoading(false)
  }

  async function updateRouteStatus(routeId, newStatus) {
    setUpdatingId(routeId)
    setError('')
    setMessage('')
  
    const { data, error } = await supabase
      .from('routes')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', routeId)
      .select()
  
    if (error) {
      console.error('Update route status error:', error)
      setError(error.message)
      setUpdatingId(null)
      return
    }
  
    if (!data || data.length === 0) {
      setError('Route was not updated. Check your Supabase permissions (RLS).')
      setUpdatingId(null)
      return
    }
  
    // Update the UI immediately
    setRoutes((currentRoutes) =>
      currentRoutes.map((route) =>
        route.id === routeId
          ? {
              ...route,
              status: newStatus,
              updated_at: new Date().toISOString(),
            }
          : route
      )
    )
  
    setMessage(
      `Route successfully ${newStatus === 'OPEN' ? 'opened' : 'closed'}.`
    )
  
    setUpdatingId(null)
  }

  function getStatusClass(status) {
    if (!status) return ''

    return `route-status-${status
      .toLowerCase()
      .replace(/\s+/g, '-')}`
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-content">
          <p>Loading routes...</p>
        </div>
      </div>
    )
  }

  const openRoutes = routes.filter(
    (route) =>
      route.status?.toUpperCase() === 'OPEN'
  ).length

  const closedRoutes = routes.filter(
    (route) =>
      route.status?.toUpperCase() === 'CLOSED'
  ).length

  return (
    <div className="dashboard-page">
      <div className="page-content">

        {/* Header */}
        <div className="page-heading">
          <div>
            <h1>Manage Routes</h1>
            <p>
              View and manage logistics routes.
            </p>
          </div>

          <button onClick={onBack}>
            ← Back to Dashboard
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="alert alert-success">
            {message}
          </div>
        )}

        {/* Route Summary */}
        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-label">
              Total Routes
            </div>

            <div className="stat-value">
              {routes.length}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Open Routes
            </div>

            <div className="stat-value">
              {openRoutes}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Closed Routes
            </div>

            <div className="stat-value">
              {closedRoutes}
            </div>
          </div>

        </div>

        {/* Routes Table */}
        <section>

          <div className="section-header">
            <div>
              <h2>Available Routes</h2>

              <p className="section-description">
                Routes currently configured in the
                logistics system.
              </p>
            </div>

            <button onClick={loadRoutes}>
              ↻ Refresh
            </button>
          </div>

          {routes.length === 0 ? (
            <p>No routes found.</p>
          ) : (
            <div className="table-container">

              <table>

                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>Drivers</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Last Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>

                  {routes.map((route) => (
                    <tr key={route.id}>

                      <td>
                        <strong>
                          {route.name}
                        </strong>
                      </td>

                      <td>
                        {route.origin}
                      </td>

                      <td>
                        {route.destination}
                      </td>

                      <td>
  {route.drivers && route.drivers.length > 0 ? (
    <div className="route-drivers">
      {route.drivers.map((driver) => (
        <div
          key={driver.id}
          className="route-driver"
        >
          <strong>
            {driver.name || 'Unnamed Driver'}
          </strong>

          {driver.email && (
            <small>
              {driver.email}
            </small>
          )}
        </div>
      ))}
    </div>
  ) : (
    <span>
      No drivers assigned
    </span>
  )}
</td>

                      <td>
                        <span
                          className={`route-status-badge ${getStatusClass(
                            route.status
                          )}`}
                        >
                          {route.status || '-'}
                        </span>
                      </td>

                      <td>
                        {route.description || '-'}
                      </td>

                      <td>
                        {route.updated_at
                          ? new Date(
                              route.updated_at
                            ).toLocaleDateString()
                          : '-'}
                      </td>

                      <td>
                        {route.status?.toUpperCase() ===
                        'OPEN' ? (
                          <button
                            onClick={() =>
                              updateRouteStatus(
                                route.id,
                                'CLOSED'
                              )
                            }
                            disabled={
                              updatingId === route.id
                            }
                          >
                            {updatingId === route.id
                              ? 'Closing...'
                              : 'Close Route'}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              updateRouteStatus(
                                route.id,
                                'OPEN'
                              )
                            }
                            disabled={
                              updatingId === route.id
                            }
                          >
                            {updatingId === route.id
                              ? 'Opening...'
                              : 'Open Route'}
                          </button>
                        )}
                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>
    </div>
  )
}

export default AdminRoutes