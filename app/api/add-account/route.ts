import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { AddAccountResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  let body: { kid?: string; machineId?: string; channelId?: string; channelName?: string }
  try { body = await req.json() } catch { return err('Invalid JSON') }

  const { kid, machineId, channelId, channelName } = body
  if (!kid || !machineId || !channelId)
    return err('kid, machineId, channelId là bắt buộc')

  // 1. Check revocation
  const { data: revoked } = await supabase
    .from('revoked_licenses')
    .select('kid')
    .eq('kid', kid)
    .maybeSingle()
  if (revoked) return err('License này đã bị thu hồi', 403)

  // 2. Verify machine has an active activation
  const { data: activation } = await supabase
    .from('activations')
    .select('max_accounts')
    .eq('kid', kid)
    .eq('machine_id', machineId)
    .eq('is_active', true)
    .maybeSingle()
  if (!activation)
    return err('Máy này chưa kích hoạt license. Vui lòng import license trước.', 403)

  // 3. Count accounts globally for this license (excluding this channel — re-add is OK)
  const { count: existingCount } = await supabase
    .from('license_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('kid', kid)
    .neq('youtube_channel_id', channelId)

  if ((existingCount ?? 0) >= activation.max_accounts)
    return err(`License chỉ cho phép tối đa ${activation.max_accounts} tài khoản YouTube`)

  // 4. Upsert account
  const { error: upsertErr } = await supabase
    .from('license_accounts')
    .upsert({
      kid,
      machine_id:         machineId,
      youtube_channel_id: channelId,
      channel_name:       channelName ?? null,
    }, { onConflict: 'kid,youtube_channel_id' })

  if (upsertErr) {
    console.error('Upsert account failed:', upsertErr)
    return err('Lỗi server khi lưu thông tin tài khoản', 500)
  }

  // 5. Return updated total count
  const { count: newCount } = await supabase
    .from('license_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('kid', kid)

  const res: AddAccountResponse = { success: true, account_count: newCount ?? 1 }
  return NextResponse.json(res)
}

function err(message: string, status = 400) {
  return NextResponse.json<AddAccountResponse>({ success: false, error: message }, { status })
}
