import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function checkAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

// GET /api/admin/activations?kid=LS-xxx   — list activations for a license
export async function GET(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const kid = req.nextUrl.searchParams.get('kid')

  let query = supabase
    .from('activations')
    .select('kid, machine_id, machine_name, plan, modules, expires_at, activated_at, last_heartbeat, is_active')
    .order('activated_at', { ascending: false })
    .limit(100)

  if (kid) query = query.eq('kid', kid)

  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data })
}
