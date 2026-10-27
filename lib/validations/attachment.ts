export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_SIZE = MAX_ATTACHMENT_SIZE

// Content types the upload pipeline can produce (magic-byte detected). The
// serve route clamps to this set so a restored backup row cannot make the
// server declare an arbitrary Content-Type for a stored file.
export const SERVEABLE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
])

type MimeInfo = { mime: string; ext: string }

function detectMime(data: Uint8Array): MimeInfo | null {
  if (data.length < 12) return null

  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
    data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' }
  }

  // WebP: RIFF....WEBP
  if (
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }

  // HEIC: ....ftyp + brand starting with hei/mif/msf/hevc
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    const brand = String.fromCharCode(data[8], data[9], data[10], data[11])
    if (/^(heic|heix|heim|heis|hevc|hevx|hevs|hevm|mif1|msf1)$/.test(brand)) {
      return { mime: 'image/heic', ext: 'heic' }
    }
  }

  // PDF: %PDF
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) {
    return { mime: 'application/pdf', ext: 'pdf' }
  }

  return null
}

function sanitizeFilename(name: string, ext: string): string {
  const base = (name.split('.')[0] ?? '')
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .slice(0, 100) || 'file'
  return `${base}.${ext}`
}

export type ValidatedFile = {
  contentType: string
  ext: string
  filename: string
  size: number
}

export function validateAttachment(filename: string, data: Uint8Array): ValidatedFile {
  if (data.byteLength > MAX_SIZE) {
    throw new Error('File exceeds 10 MB limit')
  }

  const detected = detectMime(data)
  if (!detected) {
    throw new Error('Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, PDF')
  }

  return {
    contentType: detected.mime,
    ext: detected.ext,
    filename: sanitizeFilename(filename, detected.ext),
    size: data.byteLength,
  }
}
