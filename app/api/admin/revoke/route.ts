import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function checkAdmin(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

// POST /api/admin/revoke  — revoke a license by kid
export async function POST(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  let body: { kid?: string; reason?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.kid)
    return NextResponse.json({ success: false, error: 'kid là bắt buộc' }, { status: 400 })

  const { error } = await supabase
    .from('revoked_licenses')
    .upsert({ kid: body.kid, reason: body.reason ?? null }, { onConflict: 'kid' })

  if (error) {
    console.error('Revoke failed:', error)
    return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 })
  }

  // Deactivate all activations for this kid
  await supabase.from('activations').update({ is_active: false }).eq('kid', body.kid)

  return NextResponse.json({ success: true, message: `License ${body.kid} đã bị thu hồi` })
}

// DELETE /api/admin/revoke  — unrevoke
export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  let body: { kid?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.kid)
    return NextResponse.json({ success: false, error: 'kid là bắt buộc' }, { status: 400 })

  await supabase.from('revoked_licenses').delete().eq('kid', body.kid)
  await supabase.from('activations').update({ is_active: true }).eq('kid', body.kid)

  return NextResponse.json({ success: true, message: `License ${body.kid} đã được khôi phục` })
}
