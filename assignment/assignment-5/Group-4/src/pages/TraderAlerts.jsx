import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function TraderAlerts({ profile, onBack }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAlerts()

    const channel = supabase
      .channel(`trader-alerts-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          setAlerts((current) => [
            payload.new,
            ...current,
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile.id])

  async function loadAlerts() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('alerts')
      .select(`
        id,
        route_id,
        shipment_id,
        recipient_id,
        message,
        severity,
        is_read,
        created_at
      `)
      .eq('recipient_id', profile.id)
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error('Alert error:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    setAlerts(data || [])
    setLoading(false)
  }

  async function markAsRead(alertId) {
    const { error } = await supabase
      .from('alerts')
      .update({
        is_read: true,
      })
      .eq('id', alertId)
      .eq('recipient_id', profile.id)

    if (error) {
      console.error(
        'Mark alert as read error:',
        error
      )
      return
    }

    setAlerts((current) =>
      current.map((alert) =>
        alert.id === alertId
          ? { ...alert, is_read: true }
          : alert
      )
    )
  }

  async function markAllAsRead() {
    const { error } = await supabase
      .from('alerts')
      .update({
        is_read: true,
      })
      .eq('recipient_id', profile.id)
      .eq('is_read', false)

    if (error) {
      console.error(
        'Mark all alerts as read error:',
        error
      )
      return
    }

    setAlerts((current) =>
      current.map((alert) => ({
        ...alert,
        is_read: true,
      }))
    )
  }

  const unreadCount = alerts.filter(
    (alert) => !alert.is_read
  ).length

  if (loading) {
    return (
      <div>
        <div className="page-heading">
          <h1>Alerts</h1>

          <button onClick={onBack}>
            ← Back to Dashboard
          </button>
        </div>

        <p>Loading alerts...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-heading">
        <h1>Alerts</h1>

        <button onClick={onBack}>
          ← Back to Dashboard
        </button>
      </div>

      {error && (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <p>
          {unreadCount} unread alert
          {unreadCount !== 1 ? 's' : ''}
        </p>

        {unreadCount > 0 && (
          <button onClick={markAllAsRead}>
            Mark All as Read
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <p>No alerts found.</p>
      ) : (
        <div>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() =>
                !alert.is_read &&
                markAsRead(alert.id)
              }
              style={{
                border: '1px solid #ddd',
                padding: '16px',
                marginBottom: '10px',
                borderRadius: '8px',
                backgroundColor: alert.is_read
                  ? '#fff'
                  : '#f5f8ff',
                cursor: alert.is_read
                  ? 'default'
                  : 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  marginBottom: '8px',
                }}
              >
                <strong>
                  {alert.severity}
                </strong>

                {!alert.is_read && (
                  <span>
                    Unread
                  </span>
                )}
              </div>

              <p>
                {alert.message}
              </p>

              {alert.shipment_id && (
                <p>
                  Shipment ID:{' '}
                  {alert.shipment_id}
                </p>
              )}

              {alert.route_id && (
                <p>
                  Route ID:{' '}
                  {alert.route_id}
                </p>
              )}

              <small>
                {new Date(
                  alert.created_at
                ).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TraderAlerts