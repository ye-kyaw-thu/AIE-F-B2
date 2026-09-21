import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ShipmentDetails from '../pages/ShipmentDetails'
import TraderAlerts from '../pages/TraderAlerts'
import TraderDocuments from '../pages/TraderDocuments'

function TraderDashboard({ profile, onLogout }) {
  const [page, setPage] = useState('dashboard')

  const [shipments, setShipments] = useState([])
  const [detailsShipmentId, setDetailsShipmentId] = useState(null)

  const [trackingNumber, setTrackingNumber] = useState('')
  const [cargoDescription, setCargoDescription] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [routes, setRoutes] = useState([])
  const [selectedRouteId, setSelectedRouteId] = useState('')

  useEffect(() => {
    loadShipments()
    loadRoutes()
  
    // Keep your existing realtime subscription below

    const channel = supabase
      .channel('trader-shipments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `trader_id=eq.${profile.id}`,
        },
        () => {
          loadShipments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadShipments() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('shipments')
      .select(`
        id,
        tracking_number,
        cargo_description,
        origin,
        destination,
        status,
        latitude,
        longitude,
        created_at
      `)
      .eq('trader_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Shipment error:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    setShipments(data || [])
    setLoading(false)
  }

  function openCreateShipment() {
    setTrackingNumber('')
    setCargoDescription('')
    setOrigin('')
    setDestination('')
    setSelectedRouteId('')
    setMessage('')
    setError('')
    setPage('create')
  }

  function openTracking(shipmentId) {
    setDetailsShipmentId(shipmentId)
    setError('')
    setMessage('')
  }

  async function loadRoutes() {
    const { data, error } = await supabase
      .from('routes')
      .select('id, name, origin, destination, status')
      .eq('status', 'OPEN')
      .order('name')
  
    if (error) {
      console.error('Routes error:', error)
      setError(error.message)
      return
    }
  
    setRoutes(data || [])
  }

  async function createShipment(e) {
    e.preventDefault()

    setSaving(true)
    setMessage('')
    setError('')

    const { data, error } = await supabase
  .from('shipments')
  .insert({
    tracking_number: trackingNumber,
    trader_id: profile.id,
    cargo_description: cargoDescription,
    route_id: selectedRouteId,
    origin,
    destination,
    status: 'REQUESTED',
  })
      .select()
      .single()

    if (error) {
      console.error('Create shipment error:', error)
      setError(error.message)
      setSaving(false)
      return
    }

    setMessage(
      `Shipment ${data.tracking_number} created successfully.`
    )

    setSaving(false)

    await loadShipments()

    setTimeout(() => {
      setPage('shipments')
      setMessage('')
    }, 1000)
  }

  if (loading) {
    return <p>Loading dashboard...</p>
  }

  // Alerts Page
  if (page === 'alerts') {
    return (
      <TraderAlerts
        profile={profile}
        onBack={() => setPage('dashboard')}
      />
    )
  }

  // Documents Page
  if (page === 'documents') {
    return (
      <TraderDocuments
        profile={profile}
        onBack={() => setPage('dashboard')}
      />
    )
  }

  // Shipment Tracking Page
  if (detailsShipmentId) {
    return (
      <ShipmentDetails
        shipmentId={detailsShipmentId}
        onBack={() => setDetailsShipmentId(null)}
      />
    )
  }

  // Create Shipment Page
  if (page === 'create') {
    return (
      <div>
        <div className="page-heading">
          <h1>Create Shipment</h1>

          <button onClick={() => setPage('dashboard')}>
            ← Back to Dashboard
          </button>
        </div>

        {error && (
          <p style={{ color: 'red' }}>
            {error}
          </p>
        )}

        {message && (
          <p style={{ color: 'green' }}>
            {message}
          </p>
        )}

        <form onSubmit={createShipment}>
          <div>
            <label>Tracking Number</label>

            <input
              type="text"
              value={trackingNumber}
              onChange={(e) =>
                setTrackingNumber(e.target.value)
              }
              placeholder="Example: MYT-2026-002"
              required
            />
          </div>

          <div>
            <label>Cargo Description</label>

            <input
              type="text"
              value={cargoDescription}
              onChange={(e) =>
                setCargoDescription(e.target.value)
              }
              placeholder="Example: Electronic products"
              required
            />
          </div>


          <div>
  <label>Choose Route</label>

  <select
    value={selectedRouteId}
    onChange={(e) => {
      const routeId = e.target.value
      setSelectedRouteId(routeId)

      const selectedRoute = routes.find(
        (route) => String(route.id) === routeId
      )

      if (selectedRoute) {
        setOrigin(selectedRoute.origin)
        setDestination(selectedRoute.destination)
      } else {
        setOrigin('')
        setDestination('')
      }
    }}
    required
  >
    <option value="">
      Select an available route
    </option>

    {routes.map((route) => (
      <option
        key={route.id}
        value={route.id}
      >
        {route.name} — {route.origin} → {route.destination}
      </option>
    ))}
  </select>
</div>

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Creating...'
              : 'Create Shipment'}
          </button>
        </form>
      </div>
    )
  }

  // My Shipments Page
  if (page === 'shipments') {
    return (
      <div>
        <div className="page-heading">
          <h1>My Shipments</h1>

          <button onClick={() => setPage('dashboard')}>
            ← Back to Dashboard
          </button>
        </div>

        {error && (
          <p style={{ color: 'red' }}>
            {error}
          </p>
        )}

        {message && (
          <p style={{ color: 'green' }}>
            {message}
          </p>
        )}

        {shipments.length === 0 ? (
          <p>No shipments found.</p>
        ) : (
          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>Tracking Number</th>
                <th>Cargo</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>
                    {shipment.tracking_number}
                  </td>

                  <td>
                    {shipment.cargo_description}
                  </td>

                  <td>
                    {shipment.origin}
                  </td>

                  <td>
                    {shipment.destination}
                  </td>

                  <td>
                    {shipment.status}
                  </td>

                  <td>
                    {shipment.latitude ?? '-'}
                  </td>

                  <td>
                    {shipment.longitude ?? '-'}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        openTracking(shipment.id)
                      }
                    >
                      Track
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // Main Trader Dashboard
  return (
    <div>
      <header>
        <h1>Trader Dashboard</h1>

        <p>Welcome, {profile.name}</p>

        <button onClick={onLogout}>
          Sign Out
        </button>
      </header>

      <section>
        <h2>Shipment Management</h2>

        <button onClick={() => setPage('shipments')}>
          My Shipments
        </button>

        <button onClick={openCreateShipment}>
          Create Shipment
        </button>

        <button
          onClick={() => setPage('shipments')}
        >
          Track Shipment
        </button>

        <button onClick={() => setPage('alerts')}>
          Alerts
        </button>

        <button onClick={() => setPage('documents')}>
          Documents
        </button>
      </section>

      <section>
        <h2>Overview</h2>

        <p>
          My Shipments: {shipments.length}
        </p>
      </section>
    </div>
  )
}

export default TraderDashboard