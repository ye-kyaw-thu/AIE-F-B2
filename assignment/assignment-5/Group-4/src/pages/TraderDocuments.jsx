import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function TraderDocuments({ profile, onBack }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  async function loadDocuments() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        shipment_id,
        file_name,
        file_url,
        document_type,
        created_at,
        shipments!inner (
          tracking_number,
          trader_id
        )
      `)
      .eq('shipments.trader_id', profile.id)
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error('Documents error:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    setDocuments(data || [])
    setLoading(false)
  }

  async function viewDocument(filePath) {
    const { data, error } = await supabase.storage
      .from('shipment-documents')
      .createSignedUrl(filePath, 60 * 10)

    if (error) {
      console.error('Signed URL error:', error)
      setError(error.message)
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-content">
          <p>Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="page-content">

        {/* Header */}
        <div className="page-heading">
          <div>
            <h1>Documents</h1>
            <p>
              Documents uploaded for your shipments.
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

        {/* Summary */}
        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-label">
              Total Documents
            </div>

            <div className="stat-value">
              {documents.length}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Delivery Documents
            </div>

            <div className="stat-value">
              {
                documents.filter(
                  (document) =>
                    document.document_type === 'DELIVERY'
                ).length
              }
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Cargo Documents
            </div>

            <div className="stat-value">
              {
                documents.filter(
                  (document) =>
                    document.document_type === 'CARGO'
                ).length
              }
            </div>
          </div>

        </div>

        {/* Documents */}
        <section>

          <div className="section-header">
            <div>
              <h2>My Shipment Documents</h2>

              <p className="section-description">
                Documents associated with your shipments.
              </p>
            </div>

            <button onClick={loadDocuments}>
              ↻ Refresh
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                📄
              </div>

              <h3>No documents</h3>

              <p>
                No documents have been uploaded for your
                shipments yet.
              </p>
            </div>
          ) : (
            <div className="table-container">

              <table>

                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Shipment</th>
                    <th>Document Type</th>
                    <th>Uploaded</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>

                  {documents.map((document) => (
                    <tr key={document.id}>

                      <td>
                        <strong>
                          {document.file_name}
                        </strong>
                      </td>

                      <td>
                        {
                          document.shipments
                            ?.tracking_number || '-'
                        }
                      </td>

                      <td>
                        <span className="document-type-badge">
                          {document.document_type || 'OTHER'}
                        </span>
                      </td>

                      <td>
                        {document.created_at
                          ? new Date(
                              document.created_at
                            ).toLocaleString()
                          : '-'}
                      </td>

                      <td>
                        <button
                          onClick={() =>
                            viewDocument(
                              document.file_url
                            )
                          }
                        >
                          View Document
                        </button>
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

export default TraderDocuments