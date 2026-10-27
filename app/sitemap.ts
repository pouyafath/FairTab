import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Only the static marketing pages are listed — groups and personal data are
  // not meant to be publicly indexed (see docs/project-overview.md, no-auth trust model).
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
