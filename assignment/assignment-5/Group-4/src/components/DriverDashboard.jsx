import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  addToOfflineQueue,
  getOfflineQueue,
  syncOfflineQueue,
} from '../lib/offlineQueue'

function DriverDashboard({ profile, onLogout }) {
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)

  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  const [selectedStatus, setSelectedStatus] = useState('')
  const [events, setEvents] = useState([])
  const [documents, setDocuments] = useState([])

  const [selectedFile, setSelectedFile] = useState(null)
  const [documentType, setDocumentType] = useState('')

  const [loading, setLoading] = useState(true)
  const [savingLocation, setSavingLocation] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [gpsRunning, setGpsRunning] = useState(false)
  const gpsIntervalRef = useRef(null)

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  )
  
  const [offlineQueueCount, setOfflineQueueCount] =
    useState(
      getOfflineQueue().length
    )

  useEffect(() => {
    loadShipments()
  }, [])

  useEffect(() => {
    async function handleOnline() {
      setIsOnline(true)
  
      const result =
        await syncOfflineQueue(supabase)
  
      setOfflineQueueCount(
        getOfflineQueue().length
      )
  
      if (result.synced > 0) {
        setMessage(
          `${result.synced} offline action(s) synchronized successfully.`
        )
  
        await loadShipments()
  
        if (selectedShipment) {
          await loadEvents(selectedShipment.id)
        }
      }
    }
  
    function handleOffline() {
      setIsOnline(false)
  
      setMessage(
        'You are offline. New actions will be saved locally.'
      )
    }
  
    window.addEventListener(
      'online',
      handleOnline
    )
  
    window.addEventListener(
      'offline',
      handleOffline
    )
  
    return () => {
      window.removeEventListener(
        'online',
        handleOnline
      )
  
      window.removeEventListener(
        'offline',
        handleOffline
      )
    }
  }, [selectedShipment])

  // Stop GPS simulation when the component is removed
  useEffect(() => {
    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current)
        gpsIntervalRef.current = null
      }
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
        driver_id,
        route_id
      `)
      .eq('driver_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setError(error.message)
      setLoading(false)
      return
    }

    setShipments(data || [])
    setLoading(false)
  }

  async function selectShipment(shipment) {
    // Stop any previous GPS simulation
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current)
      gpsIntervalRef.current = null
    }

    setGpsRunning(false)

    setSelectedShipment(shipment)

    setLatitude(shipment.latitude ?? '')
    setLongitude(shipment.longitude ?? '')
    setSelectedStatus(shipment.status)

    setSelectedFile(null)
    setDocumentType('')

    setMessage('')
    setError('')

    await loadEvents(shipment.id)
    await loadDocuments(shipment.id)
  }

  async function loadEvents(shipmentId) {
    const { data, error } = await supabase
      .from('shipment_events')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setError(error.message)
      return
    }

    setEvents(data || [])
  }

  async function loadDocuments(shipmentId) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setError(error.message)
      return
    }

    setDocuments(data || [])
  }

  // --------------------------------------------------
  // MANUAL GPS LOCATION UPDATE
  // --------------------------------------------------
  async function updateLocation(e) {
    e.preventDefault()
  
    if (!selectedShipment) return
  
    if (!latitude || !longitude) {
      setError('Please enter both latitude and longitude.')
      return
    }
  
    setSavingLocation(true)
    setError('')
    setMessage('')
  
    const lat = Number(latitude)
    const lng = Number(longitude)
  
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Latitude and longitude must be valid numbers.')
      setSavingLocation(false)
      return
    }
  
    if (lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90.')
      setSavingLocation(false)
      return
    }
  
    if (lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180.')
      setSavingLocation(false)
      return
    }
  
    const now = new Date().toISOString()
  
    // --------------------------------------------------
    // OFFLINE MODE
    // --------------------------------------------------
  
    if (!navigator.onLine) {
      const item = addToOfflineQueue({
        type: 'GPS',
        shipmentId: selectedShipment.id,
        userId: profile.id,
        latitude: lat,
        longitude: lng,
        recordedAt: now,
      })
  
      setOfflineQueueCount(
        getOfflineQueue().length
      )
  
      // Update the screen immediately
      const updatedShipment = {
        ...selectedShipment,
        latitude: lat,
        longitude: lng,
      }
  
      setSelectedShipment(updatedShipment)
  
      setShipments((current) =>
        current.map((shipment) =>
          shipment.id === selectedShipment.id
            ? updatedShipment
            : shipment
        )
      )
  
      setMessage(
        'You are offline. Location saved to the offline queue.'
      )
  
      console.log(
        'GPS action saved offline:',
        item
      )
  
      setSavingLocation(false)
      return
    }
  
    // --------------------------------------------------
    // ONLINE MODE
    // --------------------------------------------------
  
    // Update current shipment location
    const { error: shipmentError } = await supabase
      .from('shipments')
      .update({
        latitude: lat,
        longitude: lng,
        updated_at: now,
      })
      .eq('id', selectedShipment.id)
  
    if (shipmentError) {
      console.error(shipmentError)
      setError(shipmentError.message)
      setSavingLocation(false)
      return
    }
  
    // Save location history
    const { error: locationError } = await supabase
      .from('shipment_locations')
      .insert({
        shipment_id: selectedShipment.id,
        recorded_by: profile.id,
        latitude: lat,
        longitude: lng,
        recorded_at: now,
        source: 'SIMULATED',
      })
  
    if (locationError) {
      console.error(locationError)
      setError(locationError.message)
      setSavingLocation(false)
      return
    }
  
    const updatedShipment = {
      ...selectedShipment,
      latitude: lat,
      longitude: lng,
    }
  
    setSelectedShipment(updatedShipment)
  
    setShipments((current) =>
      current.map((shipment) =>
        shipment.id === selectedShipment.id
          ? updatedShipment
          : shipment
      )
    )
  
    setMessage(
      'Location updated successfully.'
    )
  
    setSavingLocation(false)
  }

  // --------------------------------------------------
  // AUTOMATIC GPS SIMULATION
  // --------------------------------------------------

  async function simulateGPS() {
    if (!selectedShipment) return

    const currentLat =
      Number(selectedShipment.latitude) || 21.9588

    const currentLng =
      Number(selectedShipment.longitude) || 96.0891

    // Generate a small movement
    const newLat =
      currentLat + (Math.random() - 0.5) * 0.01

    const newLng =
      currentLng + (Math.random() - 0.5) * 0.01

    const lat = Number(newLat.toFixed(6))
    const lng = Number(newLng.toFixed(6))

    const now = new Date().toISOString()

    // Update input fields
    setLatitude(lat)
    setLongitude(lng)

    setError('')

    // Update current shipment location
    const { error: shipmentError } = await supabase
      .from('shipments')
      .update({
        latitude: lat,
        longitude: lng,
        updated_at: now,
      })
      .eq('id', selectedShipment.id)

    if (shipmentError) {
      console.error(
        'GPS shipment update error:',
        shipmentError
      )

      setError(shipmentError.message)
      return
    }

    // Save GPS history
    const { error: locationError } = await supabase
      .from('shipment_locations')
      .insert({
        shipment_id: selectedShipment.id,
        recorded_by: profile.id,
        latitude: lat,
        longitude: lng,
        recorded_at: now,
        source: 'SIMULATED',
      })

    if (locationError) {
      console.error(
        'GPS history error:',
        locationError
      )

      setError(locationError.message)
      return
    }

    // Update selected shipment in React state
    const updatedShipment = {
      ...selectedShipment,
      latitude: lat,
      longitude: lng,
    }

    setSelectedShipment(updatedShipment)

    // Update shipment list
    setShipments((current) =>
      current.map((shipment) =>
        shipment.id === selectedShipment.id
          ? updatedShipment
          : shipment
      )
    )

    setMessage(
      `GPS updated: ${lat}, ${lng}`
    )
  }

  function startGPSSimulation() {
    if (!selectedShipment) return

    // Prevent multiple timers
    if (gpsIntervalRef.current) {
      return
    }

    setGpsRunning(true)
    setError('')
    setMessage('GPS simulation started.')

    // Generate the first location immediately
    simulateGPS()

    // Generate a new location every 5 seconds
    gpsIntervalRef.current = setInterval(() => {
      simulateGPS()
    }, 5000)
  }

  function stopGPSSimulation() {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current)
      gpsIntervalRef.current = null
    }

    setGpsRunning(false)
    setMessage('GPS simulation stopped.')
  }

  // --------------------------------------------------
  // UPDATE SHIPMENT STATUS
  // --------------------------------------------------

  async function updateStatus(e) {
    e.preventDefault()

    if (!selectedShipment) return

    if (!selectedStatus) {
      setError('Please select a status.')
      return
    }

    if (selectedStatus === selectedShipment.status) {
      setError('Please select a different status.')
      return
    }

    setSavingStatus(true)
    setError('')
    setMessage('')

    const now = new Date().toISOString()

    // Update shipment status
    const { error: shipmentError } = await supabase
      .from('shipments')
      .update({
        status: selectedStatus,
        updated_at: now,
      })
      .eq('id', selectedShipment.id)

    if (shipmentError) {
      console.error(shipmentError)
      setError(shipmentError.message)
      setSavingStatus(false)
      return
    }

    // Create shipment event
    const { error: eventError } = await supabase
      .from('shipment_events')
      .insert({
        shipment_id: selectedShipment.id,
        status: selectedStatus,
        description: `Shipment status updated to ${selectedStatus}`,
        latitude: selectedShipment.latitude,
        longitude: selectedShipment.longitude,
        created_by: profile.id,
      })

    if (eventError) {
      console.error(eventError)
      setError(eventError.message)
      setSavingStatus(false)
      return
    }

    const updatedShipment = {
      ...selectedShipment,
      status: selectedStatus,
    }

    setSelectedShipment(updatedShipment)

    setShipments((current) =>
      current.map((shipment) =>
        shipment.id === selectedShipment.id
          ? updatedShipment
          : shipment
      )
    )

    await loadEvents(selectedShipment.id)

    setMessage(
      'Shipment status updated successfully.'
    )

    setSavingStatus(false)
  }

  // --------------------------------------------------
  // DOCUMENT UPLOAD
  // --------------------------------------------------

  async function uploadDocument(e) {
    e.preventDefault()

    if (!selectedShipment) return

    if (!selectedFile) {
      setError('Please select a file.')
      return
    }

    if (!documentType) {
      setError('Please select a document type.')
      return
    }

    setUploadingDocument(true)
    setError('')
    setMessage('')

    const fileExtension =
      selectedFile.name.split('.').pop()

    const filePath =
      `${selectedShipment.id}/${crypto.randomUUID()}.${fileExtension}`

    // Upload file to private Storage bucket
    const { error: uploadError } =
      await supabase.storage
        .from('shipment-documents')
        .upload(filePath, selectedFile)

    if (uploadError) {
      console.error(
        'Storage upload error:',
        uploadError
      )

      setError(uploadError.message)
      setUploadingDocument(false)
      return
    }

    // Save document information to database
    const { error: databaseError } =
      await supabase
        .from('documents')
        .insert({
          shipment_id: selectedShipment.id,
          driver_id: profile.id,
          file_name: selectedFile.name,
          file_url: filePath,
          document_type: documentType,
        })

    if (databaseError) {
      console.error(
        'Document database error:',
        databaseError
      )

      // Remove Storage file if database insert fails
      await supabase.storage
        .from('shipment-documents')
        .remove([filePath])

      setError(databaseError.message)
      setUploadingDocument(false)
      return
    }

    setSelectedFile(null)
    setDocumentType('')

    await loadDocuments(selectedShipment.id)

    setMessage(
      'Document uploaded successfully.'
    )

    setUploadingDocument(false)
  }

  // --------------------------------------------------
  // CLOSE SHIPMENT
  // --------------------------------------------------

  function closeShipment() {
    stopGPSSimulation()

    setSelectedShipment(null)

    setEvents([])
    setDocuments([])

    setLatitude('')
    setLongitude('')
    setSelectedStatus('')

    setSelectedFile(null)
    setDocumentType('')

    setMessage('')
    setError('')
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <p>
        Loading assigned shipments...
      </p>
    )
  }

  // --------------------------------------------------
  // SHIPMENT DETAILS PAGE
  // --------------------------------------------------

  if (selectedShipment) {
    return (
      <div>
        <header>
          <button onClick={closeShipment}>
            ← Back to Shipments
          </button>

          <h1>Shipment Details</h1>

          <p>
            Driver: {profile.name}
          </p>

          <button onClick={onLogout}>
            Sign Out
          </button>
        </header>

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

{/* Connection Status */}
<section>
  <p>
    <strong>Connection:</strong>{' '}
    {isOnline ? 'Online' : 'Offline'}
  </p>

  <p>
    <strong>Offline Queue:</strong>{' '}
    {offlineQueueCount}
  </p>
</section>

        {/* Shipment Information */}
        <section>
          <h2>Shipment Information</h2>

          <p>
            <strong>Tracking Number:</strong>{' '}
            {selectedShipment.tracking_number}
          </p>

          <p>
            <strong>Cargo:</strong>{' '}
            {selectedShipment.cargo_description || '-'}
          </p>

          <p>
            <strong>Route:</strong>{' '}
            {selectedShipment.origin} →{' '}
            {selectedShipment.destination}
          </p>

          <p>
            <strong>Current Status:</strong>{' '}
            {selectedShipment.status}
          </p>
        </section>

        {/* Update Status */}
        <section>
          <h2>Update Shipment Status</h2>

          <form onSubmit={updateStatus}>
            <label>
              Status
            </label>

            <br />

            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value)
              }
            >
              <option value="REQUESTED">
                REQUESTED
              </option>

              <option value="PICKED_UP">
                PICKED_UP
              </option>

              <option value="IN_TRANSIT">
                IN_TRANSIT
              </option>

              <option value="CHECKPOINT">
                CHECKPOINT
              </option>

              <option value="DELAYED">
                DELAYED
              </option>

              <option value="CUSTOMS">
                CUSTOMS
              </option>

              <option value="DELIVERED">
                DELIVERED
              </option>
            </select>

            <br />
            <br />

            <button
              type="submit"
              disabled={savingStatus}
            >
              {savingStatus
                ? 'Updating...'
                : 'Update Status'}
            </button>
          </form>
        </section>

        {/* GPS Location */}
        <section>
          <h2>Update GPS Location</h2>

          <form onSubmit={updateLocation}>
            <div>
              <label>
                Latitude
              </label>

              <br />

              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) =>
                  setLatitude(e.target.value)
                }
                placeholder="e.g. 21.9588"
              />
            </div>

            <br />

            <div>
              <label>
                Longitude
              </label>

              <br />

              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) =>
                  setLongitude(e.target.value)
                }
                placeholder="e.g. 96.0891"
              />
            </div>

            <br />

            <button
              type="submit"
              disabled={
                savingLocation || gpsRunning
              }
            >
              {savingLocation
                ? 'Updating...'
                : 'Update Location'}
            </button>
          </form>

          <br />

          {/* GPS Simulation Controls */}
          {!gpsRunning ? (
            <button
              type="button"
              onClick={startGPSSimulation}
            >
              Start GPS Simulation
            </button>
          ) : (
            <button
              type="button"
              onClick={stopGPSSimulation}
            >
              Stop GPS Simulation
            </button>
          )}

          {gpsRunning && (
            <p style={{ color: 'green' }}>
              GPS simulation is running.
              A new location is generated
              every 5 seconds.
            </p>
          )}
        </section>

        {/* Document Upload */}
        <section>
          <h2>Upload Document</h2>

          <form onSubmit={uploadDocument}>
            <div>
              <label>
                Document Type
              </label>

              <br />

              <select
                value={documentType}
                onChange={(e) =>
                  setDocumentType(e.target.value)
                }
              >
                <option value="">
                  Select Document Type
                </option>

                <option value="DELIVERY">
                  Delivery
                </option>

                <option value="CARGO">
                  Cargo
                </option>

                <option value="CHECKPOINT">
                  Checkpoint
                </option>

                <option value="OTHER">
                  Other
                </option>
              </select>
            </div>

            <br />

            <div>
              <label>
                Select File
              </label>

              <br />

              <input
                type="file"
                onChange={(e) =>
                  setSelectedFile(
                    e.target.files[0] || null
                  )
                }
              />
            </div>

            <br />

            <button
              type="submit"
              disabled={uploadingDocument}
            >
              {uploadingDocument
                ? 'Uploading...'
                : 'Upload Document'}
            </button>
          </form>
        </section>

        {/* Uploaded Documents */}
        <section>
          <h2>Uploaded Documents</h2>

          {documents.length === 0 ? (
            <p>
              No documents uploaded.
            </p>
          ) : (
            <table
              border="1"
              cellPadding="10"
            >
              <thead>
                <tr>
                  <th>
                    File Name
                  </th>

                  <th>
                    Document Type
                  </th>

                  <th>
                    Uploaded At
                  </th>
                </tr>
              </thead>

              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      {document.file_name}
                    </td>

                    <td>
                      {document.document_type || '-'}
                    </td>

                    <td>
                      {document.created_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Shipment Timeline */}
        <section>
          <h2>Shipment Timeline</h2>

          {events.length === 0 ? (
            <p>
              No shipment events recorded.
            </p>
          ) : (
            <table
              border="1"
              cellPadding="10"
            >
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
                    <td>
                      {event.status}
                    </td>

                    <td>
                      {event.description || '-'}
                    </td>

                    <td>
                      {event.latitude ?? '-'}
                    </td>

                    <td>
                      {event.longitude ?? '-'}
                    </td>

                    <td>
                      {event.created_at}
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

  // --------------------------------------------------
  // DRIVER SHIPMENT LIST
  // --------------------------------------------------

  return (
    <div>
      <header>
        <h1>Driver Dashboard</h1>

        <p>
          Welcome, {profile.name}
        </p>

        <button onClick={onLogout}>
          Sign Out
        </button>
      </header>

      {error && (
        <p style={{ color: 'red' }}>
          Error: {error}
        </p>
      )}

      <section>
        <h2>My Assigned Shipments</h2>

        {shipments.length === 0 ? (
          <p>
            No shipments assigned to you.
          </p>
        ) : (
          <table
            border="1"
            cellPadding="10"
          >
            <thead>
              <tr>
                <th>
                  Tracking Number
                </th>

                <th>
                  Cargo
                </th>

                <th>
                  Route
                </th>

                <th>
                  Status
                </th>

                <th>
                  Location
                </th>

                <th>
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>
                    {shipment.tracking_number}
                  </td>

                  <td>
                    {shipment.cargo_description || '-'}
                  </td>

                  <td>
                    {shipment.origin} →{' '}
                    {shipment.destination}
                  </td>

                  <td>
                    {shipment.status}
                  </td>

                  <td>
                    {shipment.latitude ?? '-'},
                    {' '}
                    {shipment.longitude ?? '-'}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        selectShipment(shipment)
                      }
                    >
                      Manage
                    </button>
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

export default DriverDashboard