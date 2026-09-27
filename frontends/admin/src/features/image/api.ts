import { header } from '@/auth/oidc'

const INVENTORY_API_BASE_URL = import.meta.env.VITE_INVENTORY_API_BASE_URL ?? ''

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return body?.error ?? fallback
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  const res = await fetch(`${INVENTORY_API_BASE_URL}/admin/images`, {
    method: 'POST',
    body: formData, headers: header(),
  })
  if (!res.ok) { if (res.status === 401 || res.status === 403) window.dispatchEvent(new CustomEvent('sample-ec:auth-error', { detail: res.status })); throw new Error(await parseErrorMessage(res, 'Failed to upload image')) }

  const body: { image_key: string } = await res.json()
  return body.image_key
}
