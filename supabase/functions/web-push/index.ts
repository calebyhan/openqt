import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

interface PushPayload {
  user_id: string
  title: string
  body: string
  url?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  // Authenticate — accept either a user JWT (client-triggered) or service role key (server-triggered)
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the caller is authenticated (user JWT or service role)
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { error: authErr } = await callerClient.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  // Allow service role key as well (for server-side calls from triggers/cron)
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`
  if (authErr && !isServiceRole) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  let payload: PushPayload
  try {
    payload = await req.json() as PushPayload
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS_HEADERS })
  }

  const { user_id, title, body, url } = payload
  if (!user_id || !title || !body) {
    return new Response('Missing required fields', { status: 400, headers: CORS_HEADERS })
  }

  // Read user's push subscription using service role (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('push_subscription')
    .eq('id', user_id)
    .single()

  if (profileErr || !profile?.push_subscription) {
    // No subscription stored — nothing to do
    return new Response(JSON.stringify({ sent: false, reason: 'no_subscription' }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Configure VAPID
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const pushPayload = JSON.stringify({
    title,
    body,
    ...(url ? { data: { url } } : {}),
  })

  try {
    await webpush.sendNotification(
      profile.push_subscription as webpush.PushSubscription,
      pushPayload,
    )
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    // 410 Gone — subscription expired; clear it from the profile
    if (
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      (err as { statusCode: number }).statusCode === 410
    ) {
      await adminClient
        .from('profiles')
        .update({ push_subscription: null })
        .eq('id', user_id)
      return new Response(JSON.stringify({ sent: false, reason: 'expired' }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    throw err
  }
})
