import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

import AdminDashboard from './components/AdminDashboard'
import TraderDashboard from './components/TraderDashboard'
import DriverDashboard from './components/DriverDashboard'

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        getProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      setUser(user)
      await getProfile(user.id)
    }

    setLoading(false)
  }

  async function getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Profile error:', error)
      setError(error.message)
      return
    }

    setProfile(data)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  if (loading) {
    return <p>Loading...</p>
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  if (!profile) {
    return (
      <div>
        <h2>Loading profile...</h2>

        {error && (
          <p style={{ color: 'red' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  const role = profile.role?.toUpperCase()

  if (role === 'ADMIN') {
    return (
      <AdminDashboard
        profile={profile}
        onLogout={handleLogout}
      />
    )
  }

  if (role === 'TRADER') {
    return (
      <TraderDashboard
        profile={profile}
        onLogout={handleLogout}
      />
    )
  }

  if (role === 'DRIVER') {
    return (
      <DriverDashboard
        profile={profile}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <div>
      <h2>Unknown Role</h2>
      <p>Your role is: {profile.role}</p>

      <button onClick={handleLogout}>
        Sign Out
      </button>
    </div>
  )
}

export default App