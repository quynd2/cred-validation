import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyLicense, isExpired } from '@/lib/verify'
import type { LicensePayload, ActivateResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    { licenseData?: string; machineId?: string; machineName?: string } | null
  if (!body) return err('Invalid JSON')

  const { licenseData, machineId, machineName } = body
  if (!licenseData || !machineId) return err('licenseData và machineId là bắt buộc')

  // 1. Parse payload
  let payload: LicensePayload
  try { payload = JSON.parse(licenseData) as LicensePayload }
  catch { return err('licenseData không phải JSON hợp lệ') }

  // 2. Verify ECDSA signature
  if (!verifyLicense(payload))
    return err('Chữ ký license không hợp lệ')

  // 3. Check expiry
  if (isExpired(payload))
    return err(`License đã hết hạn vào ${payload.expires_at}`)

  const kid = payload.kid

  // 4. Check revocation
  const { data: revoked } = await supabase
    .from('revoked_licenses')
    .select('kid')
    .eq('kid', kid)
    .maybeSingle()
  if (revoked) return err('License này đã bị thu hồi')

  // 5. Count existing activations for this kid
  const { count: activationCount } = await supabase
    .from('activations')
    .select('*', { count: 'exact', head: true })
    .eq('kid', kid)
    .neq('machine_id', machineId)  // don't count this machine (re-activation is OK)

  const existingCount = activationCount ?? 0
  if (existingCount >= payload.max_activations)
    return err(`License đã đạt giới hạn ${payload.max_activations} máy`)

  // 6. Upsert activation record
  const { error: upsertErr } = await supabase
    .from('activations')
    .upsert({
      kid,
      machine_id:      machineId,
      machine_name:    machineName ?? null,
      plan:            payload.plan,
      modules:         payload.modules,
      max_accounts:    payload.max_accounts,
      max_activations: payload.max_activations,
      expires_at:      payload.expires_at ?? null,
      last_heartbeat:  new Date().toISOString(),
      is_active:       true,
    }, { onConflict: 'kid,machine_id' })

  if (upsertErr) {
    console.error('Upsert activation failed:', upsertErr)
    return err('Lỗi server khi lưu thông tin kích hoạt')
  }

  const res: ActivateResponse = {
    success:     true,
    kid,
    modules:     payload.modules,
    max_accounts: payload.max_accounts,
    expires_at:  payload.expires_at ?? null,
  }
  return NextResponse.json(res)
}

function err(message: string, status = 400) {
  return NextResponse.json<ActivateResponse>({ success: false, error: message }, { status })
}
