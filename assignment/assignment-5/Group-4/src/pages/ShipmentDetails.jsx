import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ShipmentMap from '../components/ShipmentMap'

function ShipmentDetails({ shipmentId, onBack }) {
  const [shipment, setShipment] = useState(null)
  const [events, setEvents] = useState([])
  const [locations, setLocations] = useState([])
  const [documents, setDocuments] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadShipmentDetails()

    const channel = supabase
      .channel(`shipment-tracking-${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `id=eq.${shipmentId}`,
        },
        (payload) => {
          if (payload.new) {
            setShipment(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipment_locations',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          setLocations((current) => [
            payload.new,
            ...current,
          ])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipment_events',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          setEvents((current) => [
            payload.new,
            ...current,
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [shipmentId])

  async function loadShipmentDetails() {
    setLoading(true)
    setError('')

    // Get shipment
    const {
      data: shipmentData,
      error: shipmentError,
    } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .single()

    if (shipmentError) {
      console.error(shipmentError)
      setError(shipmentError.message)
      setLoading(false)
      return
    }

    setShipment(shipmentData)

    // Get shipment events
    const {
      data: eventData,
      error: eventError,
    } = await supabase
      .from('shipment_events')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })

    if (eventError) {
      console.error(eventError)
    }

    setEvents(eventData || [])

    // Get GPS locations
    const {
      data: locationData,
      error: locationError,
    } = await supabase
      .from('shipment_locations')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('recorded_at', { ascending: false })

    if (locationError) {
      console.error(locationError)
    }

    setLocations(locationData || [])

    // Get documents
    const {
      data: documentData,
      error: documentError,
    } = await supabase
      .from('documents')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })

    if (documentError) {
      console.error(documentError)
    }

    setDocuments(documentData || [])

    setLoading(false)
  }

  if (loading) {
    return <p>Loading shipment details...</p>
  }

  if (error) {
    return (
      <div>
        <button onClick={onBack}>
          ← Back to Shipments
        </button>

        <p style={{ color: 'red' }}>
          Error: {error}
        </p>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div>
        <button onClick={onBack}>
          ← Back to Shipments
        </button>

        <p>Shipment not found.</p>
      </div>
    )
  }

  /*
   * Use the newest GPS location for the map.
   * If no GPS history exists, use the latitude/longitude
   * stored directly in the shipment.
   */
  const latestLocation = locations.length > 0
    ? locations[0]
    : null

  const mapShipment = {
    ...shipment,
    latitude:
      latestLocation?.latitude ??
      shipment.latitude,

    longitude:
      latestLocation?.longitude ??
      shipment.longitude,
  }

  return (
    <div>
      <button onClick={onBack}>
        ← Back to Shipments
      </button>

      <h1>Shipment Details</h1>

      {/* Shipment Information */}
      <section>
        <h2>Shipment Information</h2>

        <p>
          <strong>Tracking Number:</strong>{' '}
          {shipment.tracking_number}
        </p>

        <p>
          <strong>Cargo:</strong>{' '}
          {shipment.cargo_description || '-'}
        </p>

        <p>
          <strong>Origin:</strong>{' '}
          {shipment.origin}
        </p>

        <p>
          <strong>Destination:</strong>{' '}
          {shipment.destination}
        </p>

        <p>
          <strong>Status:</strong>{' '}
          {shipment.status}
        </p>
      </section>

      {/* Current Location */}
      <section>
        <h2>Current Location</h2>

        <p>
          <strong>Latitude:</strong>{' '}
          {mapShipment.latitude ?? '-'}
        </p>

        <p>
          <strong>Longitude:</strong>{' '}
          {mapShipment.longitude ?? '-'}
        </p>

        <ShipmentMap
  shipment={mapShipment}
  locations={locations}
/>
      </section>

      {/* GPS History */}
      <section>
        <h2>GPS Location History</h2>

        {locations.length === 0 ? (
          <p>No GPS locations recorded.</p>
        ) : (
          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Source</th>
                <th>Recorded At</th>
              </tr>
            </thead>

            <tbody>
              {locations.map((location) => (
                <tr key={location.id}>
                  <td>{location.latitude}</td>
                  <td>{location.longitude}</td>
                  <td>{location.source || '-'}</td>
                  <td>{location.recorded_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Timeline */}
      <section>
        <h2>Shipment Timeline</h2>

        {events.length === 0 ? (
          <p>No shipment events recorded.</p>
        ) : (
          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>Status</th>
                <th>Description</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Time</th>
              </tr>
            </thead>

            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.status}</td>
                  <td>{event.description || '-'}</td>
                  <td>{event.latitude ?? '-'}</td>
                  <td>{event.longitude ?? '-'}</td>
                  <td>{event.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Documents */}
      <section>
        <h2>Documents</h2>

        {documents.length === 0 ? (
          <p>No documents uploaded.</p>
        ) : (
          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Document Type</th>
                <th>Created At</th>
                <th>File</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.file_name}</td>

                  <td>
                    {document.document_type || '-'}
                  </td>

                  <td>{document.created_at}</td>

                  <td>
                    <a
                      href={document.file_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}


export default ShipmentDetails