const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL ?? ''

export function imageUrl(imageKey: string | null): string | null {
  if (!imageKey) return null
  return `${IMAGE_BASE_URL}/${imageKey}`
}
