import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Alerts.css'

function Alerts({ userId }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    fetchAlerts()

    // Listen for newly created alerts
    const channel = supabase
      .channel(`alerts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          setAlerts((current) => [payload.new, ...current])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function fetchAlerts() {
    setLoading(true)

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching alerts:', error)
    } else {
      setAlerts(data || [])
    }

    setLoading(false)
  }

  async function markAsRead(alertId) {
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('id', alertId)
      .eq('recipient_id', userId)

    if (error) {
      console.error('Error marking alert as read:', error)
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

  const unreadCount = alerts.filter(
    (alert) => !alert.is_read
  ).length

  if (loading) {
    return <div>Loading alerts...</div>
  }

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <h2>Alerts</h2>

        {unreadCount > 0 && (
          <span className="alert-count">
            {unreadCount}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="no-alerts">
          No alerts
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`alert-item ${
                alert.is_read ? 'read' : 'unread'
              }`}
              onClick={() => markAsRead(alert.id)}
            >
              <div className="alert-content">
                <div className="alert-top">
                  <span className="alert-severity">
                    {alert.severity}
                  </span>

                  <span className="alert-time">
                    {new Date(
                      alert.created_at
                    ).toLocaleString()}
                  </span>
                </div>

                <p>{alert.message}</p>

                {alert.shipment_id && (
                  <small>
                    Shipment ID: {alert.shipment_id}
                  </small>
                )}
              </div>

              {!alert.is_read && (
                <span className="unread-dot"></span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Alerts