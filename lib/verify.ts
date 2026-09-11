import { createVerify, createPublicKey } from 'crypto'
import type { LicensePayload } from './types.js'

/**
 * Verify the ECDSA P-256 signature of a .lic payload.
 * Must produce the same canonical string as C# LicenseCrypto.GetSignableBytes().
 */
export function verifyLicense(payload: LicensePayload): boolean {
  try {
    const publicKeyPem = process.env.LICENSE_PUBLIC_KEY!
    if (!publicKeyPem) throw new Error('LICENSE_PUBLIC_KEY not set')

    // Same canonical format as C# GetSignableBytes()
    const modules = [...payload.modules].sort().join(',')
    const canonical =
      `v${payload.version}|${payload.kid}|${payload.plan}|${modules}|` +
      `mm:${payload.max_machines}|ma:${payload.max_accounts}|mx:${payload.max_activations}|` +
      `iss:${payload.issued_at}|exp:${payload.expires_at ?? 'lifetime'}`

    const pub = createPublicKey({ key: publicKeyPem, format: 'pem' })

    const verifier = createVerify('SHA256')
    verifier.update(Buffer.from(canonical, 'utf8'))
    verifier.end()

    const sigBuf = Buffer.from(payload.sig, 'base64')

    // C# uses IeeeP1363FixedFieldConcatenation (raw r||s, 64 bytes for P-256)
    // Node.js 15+ supports dsaEncoding: 'ieee-p1363' natively
    return verifier.verify({ key: pub, dsaEncoding: 'ieee-p1363' }, sigBuf)
  } catch {
    return false
  }
}

export function isExpired(payload: LicensePayload): boolean {
  if (!payload.expires_at) return false
  return new Date(payload.expires_at) < new Date()
}
