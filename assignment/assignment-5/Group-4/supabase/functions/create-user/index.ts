import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed.' },
      405
    )
  }

  try {
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      )

      return jsonResponse(
        {
          error:
            'Supabase server configuration is missing.',
        },
        500
      )
    }

    // Admin client
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // --------------------------------
    // Get current logged-in user
    // --------------------------------

    const authHeader =
      req.headers.get('Authorization')

    if (!authHeader) {
      return jsonResponse(
        { error: 'Unauthorized.' },
        401
      )
    }

    const token = authHeader.replace(
      'Bearer ',
      ''
    )

    const {
      data: {
        user: currentUser,
      },
      error: currentUserError,
    } =
      await supabaseAdmin.auth.getUser(token)

    if (
      currentUserError ||
      !currentUser
    ) {
      console.error(
        'Current user error:',
        currentUserError
      )

      return jsonResponse(
        { error: 'Unauthorized.' },
        401
      )
    }

    // --------------------------------
    // Check admin role
    // --------------------------------

    const {
      data: adminProfile,
      error: adminProfileError,
    } =
      await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single()

    if (
      adminProfileError ||
      !adminProfile ||
      adminProfile.role !== 'ADMIN'
    ) {
      return jsonResponse(
        {
          error:
            'Only administrators can create users.',
        },
        403
      )
    }

    // --------------------------------
    // Read request
    // --------------------------------

    const body = await req.json()

    const name =
      typeof body.name === 'string'
        ? body.name.trim()
        : ''

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''

    const password =
      typeof body.password === 'string'
        ? body.password
        : ''

    const role =
      typeof body.role === 'string'
        ? body.role
        : ''

    // --------------------------------
    // Validate
    // --------------------------------

    if (
      !name ||
      !email ||
      !password ||
      !role
    ) {
      return jsonResponse(
        {
          error:
            'Name, email, password, and role are required.',
        },
        400
      )
    }

    if (password.length < 6) {
      return jsonResponse(
        {
          error:
            'Password must be at least 6 characters.',
        },
        400
      )
    }

    const allowedRoles = [
      'ADMIN',
      'TRADER',
      'DRIVER',
    ]

    if (!allowedRoles.includes(role)) {
      return jsonResponse(
        {
          error: 'Invalid user role.',
        },
        400
      )
    }

    // --------------------------------
    // Create Auth user
    // --------------------------------

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      console.error(
        'Auth create error:',
        authError
      )

      return jsonResponse(
        {
          error: authError.message,
        },
        400
      )
    }

    if (!authData.user) {
      return jsonResponse(
        {
          error:
            'User was not created in Supabase Auth.',
        },
        500
      )
    }

    const newUser = authData.user

    // --------------------------------
    // Create profile
    // --------------------------------

    const {
      error: profileError,
    } =
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUser.id,
          name,
          email,
          role,
        })

    if (profileError) {
      console.error(
        'Profile creation error:',
        profileError
      )

      // Roll back Auth user
      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id
      )

      return jsonResponse(
        {
          error:
            'User was created in Auth, but the profile could not be created: ' +
            profileError.message,
        },
        500
      )
    }

    // --------------------------------
    // Success
    // --------------------------------

    return jsonResponse({
      success: true,
      user: {
        id: newUser.id,
        name,
        email,
        role,
      },
    })
  } catch (error) {
    console.error(
      'Create user unexpected error:',
      error
    )

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected error.',
      },
      500
    )
  }
})