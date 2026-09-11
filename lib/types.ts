export interface LicensePayload {
  kid: string
  version: number
  plan: string
  modules: string[]
  max_machines: number
  max_accounts: number
  max_activations: number
  issued_at: string       // yyyy-MM-dd
  expires_at: string | null
  customer_info: string | null
  sig: string
}

export interface ApiResponse {
  success: boolean
  error?: string
}

export interface ActivateResponse extends ApiResponse {
  kid?: string
  modules?: string[]
  max_accounts?: number
  expires_at?: string | null
}

export interface AddAccountResponse extends ApiResponse {
  account_count?: number
}
