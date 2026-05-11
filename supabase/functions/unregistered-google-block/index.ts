// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// @ts-ignore
declare const Deno: any;

serve(async (req: any) => {
  const { event } = await req.json()
  const user = event.user
  const provider = user.app_metadata.provider
  const email = user.email

  // Only restrict Google OAuth (or other OAuth providers)
  if (provider !== 'email') {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if the email exists in public.profiles
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.error('Error fetching profile:', error)
      return new Response(JSON.stringify({ error: { message: 'Internal server error' } }), { status: 500 })
    }

    if (!profile) {
      // Reject the creation
      return new Response(
        JSON.stringify({
          error: {
            http_code: 403,
            message: 'No account found for this Google address. Please sign up first.'
          }
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Allow creation
  return new Response(JSON.stringify(event), { headers: { 'Content-Type': 'application/json' } })
})
