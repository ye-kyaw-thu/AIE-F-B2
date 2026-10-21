import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function AdminUsers({ onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Add User form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('TRADER')
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Users error:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    setUsers(data || [])
    setLoading(false)
  }

  async function handleCreateUser(e) {
    e.preventDefault()

    setError('')
    setMessage('')

    if (!name.trim()) {
      setError('Please enter the user name.')
      return
    }

    if (!email.trim()) {
      setError('Please enter the user email.')
      return
    }

    if (!password) {
      setError('Please enter a password.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setCreatingUser(true)

    try {
      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        'create-user',
        {
          body: {
            name: name.trim(),
            email: email.trim(),
            password,
            role,
          },
        }
      )

      if (functionError) {
        console.error(
          'Create user function error:',
          functionError
        )

        setError(
          functionError.message ||
            'Failed to create user.'
        )

        return
      }

      if (data?.error) {
        setError(data.error)
        return
      }

      setMessage(
        `User ${name.trim()} was created successfully.`
      )

      // Clear form
      setName('')
      setEmail('')
      setPassword('')
      setRole('TRADER')

      // Reload users
      await loadUsers()
    } catch (err) {
      console.error('Create user error:', err)

      setError(
        err.message ||
          'An unexpected error occurred.'
      )
    } finally {
      setCreatingUser(false)
    }
  }

  function getRoleClass(role) {
    if (role === 'ADMIN') return 'role-admin'
    if (role === 'DRIVER') return 'role-driver'
    if (role === 'TRADER') return 'role-trader'

    return ''
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-content">
          <p>Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="page-content">

        {/* Page Header */}
        <div className="page-heading">
          <div>
            <h1>Manage Users</h1>
            <p>
              Add and manage users in the logistics system.
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

        {/* Add New User */}
        <section>

          <div className="section-header">
            <div>
              <h2>Add New User</h2>
              <p className="section-description">
                Create a new user account and assign a system role.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateUser}>

            <div>
              <label>
                Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Enter full name"
                disabled={creatingUser}
              />
            </div>

            <br />

            <div>
              <label>
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="Enter email address"
                disabled={creatingUser}
              />
            </div>

            <br />

            <div>
              <label>
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter password"
                disabled={creatingUser}
              />
            </div>

            <br />

            <div>
              <label>
                Role
              </label>

              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value)
                }
                disabled={creatingUser}
              >
                <option value="TRADER">
                  TRADER
                </option>

                <option value="DRIVER">
                  DRIVER
                </option>

                <option value="ADMIN">
                  ADMIN
                </option>
              </select>
            </div>

            <br />

            <button
              type="submit"
              disabled={creatingUser}
            >
              {creatingUser
                ? 'Creating User...'
                : 'Add User'}
            </button>

          </form>

        </section>

        <br />

        {/* User Summary */}
        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-label">
              Total Users
            </div>

            <div className="stat-value">
              {users.length}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Drivers
            </div>

            <div className="stat-value">
              {
                users.filter(
                  (user) => user.role === 'DRIVER'
                ).length
              }
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Traders
            </div>

            <div className="stat-value">
              {
                users.filter(
                  (user) => user.role === 'TRADER'
                ).length
              }
            </div>
          </div>

        </div>

        {/* Users Table */}
        <section>

          <div className="section-header">
            <div>
              <h2>System Users</h2>
              <p className="section-description">
                All users registered in the logistics system.
              </p>
            </div>

            <button onClick={loadUsers}>
              ↻ Refresh
            </button>
          </div>

          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <div className="table-container">

              <table>

                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>

                  {users.map((user) => (
                    <tr key={user.id}>

                      <td>
                        <strong>
                          {user.name || '-'}
                        </strong>
                      </td>

                      <td>
                        {user.email || '-'}
                      </td>

                      <td>
                        <span
                          className={`role-badge ${getRoleClass(
                            user.role
                          )}`}
                        >
                          {user.role || '-'}
                        </span>
                      </td>

                      <td>
                        {user.created_at
                          ? new Date(
                              user.created_at
                            ).toLocaleDateString()
                          : '-'}
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

export default AdminUsers