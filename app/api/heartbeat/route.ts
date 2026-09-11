import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    { kid?: string; machineId?: string } | null
  if (!body) return err('Invalid JSON')

  const { kid, machineId } = body
  if (!kid || !machineId) return err('kid và machineId là bắt buộc')

  // Check revocation first
  const { data: revoked } = await supabase
    .from('revoked_licenses')
    .select('kid')
    .eq('kid', kid)
    .maybeSingle()
  if (revoked) return NextResponse.json({ success: false, error: 'License đã bị thu hồi' }, { status: 403 })

  // Update last_heartbeat
  const { error } = await supabase
    .from('activations')
    .update({ last_heartbeat: new Date().toISOString() })
    .eq('kid', kid)
    .eq('machine_id', machineId)
    .eq('is_active', true)

  if (error) {
    console.error('Heartbeat update failed:', error)
    // Don't fail a running stream on DB error
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: true })
}

function err(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 })
}
