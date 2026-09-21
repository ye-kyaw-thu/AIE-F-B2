import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
  } from 'react-leaflet'
  import L from 'leaflet'
  
  import 'leaflet/dist/leaflet.css'
  
  import markerIcon from 'leaflet/dist/images/marker-icon.png'
  import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
  import markerShadow from 'leaflet/dist/images/marker-shadow.png'
  
  const defaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
  
  function ShipmentMap({ shipment, locations = [] }) {
    /*
     * Convert GPS history into Leaflet positions.
     *
     * locations are ordered newest → oldest from Supabase,
     * so reverse them to draw the route from oldest → newest.
     */
    const historyPositions = locations
      .filter(
        (location) =>
          location.latitude != null &&
          location.longitude != null
      )
      .map((location) => [
        Number(location.latitude),
        Number(location.longitude),
      ])
      .reverse()
  
    /*
     * If there is no GPS history, use the current
     * shipment latitude/longitude.
     */
    const currentPosition =
      shipment?.latitude != null &&
      shipment?.longitude != null
        ? [
            Number(shipment.latitude),
            Number(shipment.longitude),
          ]
        : null
  
    /*
     * Use GPS history as the main route.
     * If there is no history, use current position.
     */
    const mapCenter =
      historyPositions.length > 0
        ? historyPositions[historyPositions.length - 1]
        : currentPosition
  
    if (!mapCenter) {
      return (
        <div>
          <p>
            Location data is not available for this shipment.
          </p>
        </div>
      )
    }
  
    return (
      <div
        style={{
          width: '100%',
          height: '450px',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom={true}
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
  
          {/* Previous GPS locations + current location */}
          {historyPositions.length > 0 && (
            <>
              {/* Route line */}
              <Polyline
                positions={historyPositions}
              />
  
              {/* Previous location markers */}
              {locations
                .filter(
                  (location) =>
                    location.latitude != null &&
                    location.longitude != null
                )
                .map((location, index) => (
                  <Marker
                    key={location.id}
                    position={[
                      Number(location.latitude),
                      Number(location.longitude),
                    ]}
                    icon={defaultIcon}
                  >
                    <Popup>
                      <strong>
                        {shipment.tracking_number}
                      </strong>
  
                      <br />
  
                      Location {index + 1}
  
                      <br />
  
                      Latitude:{' '}
                      {location.latitude}
  
                      <br />
  
                      Longitude:{' '}
                      {location.longitude}
  
                      <br />
  
                      Recorded:{' '}
                      {location.recorded_at
                        ? new Date(
                            location.recorded_at
                          ).toLocaleString()
                        : '-'}
                    </Popup>
                  </Marker>
                ))}
            </>
          )}
  
          {/* Current shipment location */}
          {currentPosition && (
            <Marker
              position={currentPosition}
              icon={defaultIcon}
            >
              <Popup>
                <strong>
                  Current Location
                </strong>
  
                <br />
  
                {shipment.tracking_number}
  
                <br />
  
                {shipment.origin} →{' '}
                {shipment.destination}
  
                <br />
  
                Status: {shipment.status}
  
                <br />
  
                Latitude: {shipment.latitude}
  
                <br />
  
                Longitude: {shipment.longitude}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    )
  }
  
  export default ShipmentMap