import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ShipmentDetails from './ShipmentDetails'

function AdminShipments({ onBack }) {
  const [shipments, setShipments] = useState([])
  const [drivers, setDrivers] = useState([])
  const [routes, setRoutes] = useState([])

  const [selectedShipment, setSelectedShipment] = useState(null)
  const [detailsShipmentId, setDetailsShipmentId] = useState(null)
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('')

  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    // Get shipments
    const { data: shipmentData, error: shipmentError } =
      await supabase
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
          trader_id,
          driver_id,
          route_id,
          created_at
        `)
        .order('created_at', { ascending: false })

    if (shipmentError) {
      console.error(shipmentError)
      setError(shipmentError.message)
      setLoading(false)
      return
    }

    // Get drivers
    const { data: driverData, error: driverError } =
      await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'DRIVER')
        .order('name')

    if (driverError) {
      console.error(driverError)
      setError(driverError.message)
      setLoading(false)
      return
    }

    // Get routes
    const { data: routeData, error: routeError } =
      await supabase
        .from('routes')
        .select(`
          id,
          name,
          origin,
          destination,
          status
        `)
        .order('name')

    if (routeError) {
      console.error(routeError)
      setError(routeError.message)
      setLoading(false)
      return
    }

    setShipments(shipmentData || [])
    setDrivers(driverData || [])
    setRoutes(routeData || [])

    setLoading(false)
  }

  function openAssignment(shipment) {
    setSelectedShipment(shipment)

    setSelectedDriver(
      shipment.driver_id || ''
    )

    setSelectedRoute(
      shipment.route_id
        ? String(shipment.route_id)
        : ''
    )

    setMessage('')
    setError('')
  }

  function closeAssignment() {
    setSelectedShipment(null)
    setSelectedDriver('')
    setSelectedRoute('')
    setMessage('')
    setError('')
  }

  async function assignShipment(e) {
    e.preventDefault()

    if (!selectedShipment) {
      return
    }

    if (!selectedDriver) {
      setError('Please select a driver.')
      return
    }

    if (!selectedRoute) {
      setError('Please select a route.')
      return
    }

    setAssigning(true)
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('shipments')
      .update({
        driver_id: selectedDriver,
        route_id: Number(selectedRoute),
      })
      .eq('id', selectedShipment.id)

    if (error) {
      console.error('Assignment error:', error)
      setError(error.message)
      setAssigning(false)
      return
    }

    setMessage(
      'Driver and route assigned successfully.'
    )

    setAssigning(false)

    await loadData()

    setSelectedShipment(null)
    setSelectedDriver('')
    setSelectedRoute('')
  }

  /*
   * ASSIGN SHIPMENT PAGE
   */
  if (selectedShipment && !loading) {
    return (
      <div className="dashboard-page">
        <div className="page-content">

          <div className="page-heading">
            <div>
              <h1>Assign Shipment</h1>
              <p>
                Assign a driver and route to this shipment.
              </p>
            </div>

            <button onClick={closeAssignment}>
              ← Back to Shipments
            </button>
          </div>

          <section>
            <h2>Shipment Information</h2>

            <p>
              <strong>Tracking Number:</strong>{' '}
              {selectedShipment.tracking_number}
            </p>

            <p>
              <strong>Origin:</strong>{' '}
              {selectedShipment.origin}
            </p>

            <p>
              <strong>Destination:</strong>{' '}
              {selectedShipment.destination}
            </p>

            <p>
              <strong>Status:</strong>{' '}
              {selectedShipment.status}
            </p>
          </section>

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

          <section>
            <h2>Assignment</h2>

            <form onSubmit={assignShipment}>

              <div>
                <label>Driver</label>

                <br />

                <select
                  value={selectedDriver}
                  onChange={(e) =>
                    setSelectedDriver(e.target.value)
                  }
                >
                  <option value="">
                    Select Driver
                  </option>

                  {drivers.map((driver) => (
                    <option
                      key={driver.id}
                      value={driver.id}
                    >
                      {driver.name} — {driver.email}
                    </option>
                  ))}
                </select>
              </div>

              <br />

              <div>
                <label>Route</label>

                <br />

                <select
                  value={selectedRoute}
                  onChange={(e) =>
                    setSelectedRoute(e.target.value)
                  }
                >
                  <option value="">
                    Select Route
                  </option>

                  {routes.map((route) => (
                    <option
                      key={route.id}
                      value={route.id}
                    >
                      {route.name} — {route.origin} →{' '}
                      {route.destination}
                    </option>
                  ))}
                </select>
              </div>

              <br />

              <button
                type="submit"
                disabled={assigning}
              >
                {assigning
                  ? 'Assigning...'
                  : 'Assign Driver & Route'}
              </button>

            </form>
          </section>

        </div>
      </div>
    )
  }

  if (loading) {
    return <p>Loading shipments...</p>
  }

  /*
   * MANAGE SHIPMENTS PAGE
   */
  return (
    <div className="dashboard-page">
      <div className="page-content">

        <div className="page-heading">
          <div>
            <h1>Manage Shipments</h1>

            <p>
              View, assign, and manage all shipments.
            </p>
          </div>

          <button onClick={onBack}>
            ← Back to Dashboard
          </button>
        </div>

        {error && (
          <p style={{ color: 'red' }}>
            Error: {error}
          </p>
        )}

        {message && (
          <p style={{ color: 'green' }}>
            {message}
          </p>
        )}

        <p>
          <strong>
            Total Shipments: {shipments.length}
          </strong>
        </p>

        {shipments.length === 0 ? (
          <p>No shipments found.</p>
        ) : (
          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>Tracking Number</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Driver ID</th>
                <th>Route ID</th>
                <th>Location</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>

                  <td>
                    <button
                      onClick={() =>
                        setDetailsShipmentId(
                          shipment.id
                        )
                      }
                    >
                      {shipment.tracking_number}
                    </button>
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
                    {shipment.driver_id
                      ? 'Assigned'
                      : 'Not assigned'}
                  </td>

                  <td>
                    {shipment.route_id
                      ? shipment.route_id
                      : 'Not assigned'}
                  </td>

                  <td>
                    {shipment.latitude ?? '-'}
                    {', '}
                    {shipment.longitude ?? '-'}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        openAssignment(shipment)
                      }
                    >
                      Assign
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Shipment Details */}
        {detailsShipmentId && (
          <ShipmentDetails
            shipmentId={detailsShipmentId}
            onBack={() =>
              setDetailsShipmentId(null)
            }
          />
        )}

      </div>
    </div>
  )
}

export default AdminShipments