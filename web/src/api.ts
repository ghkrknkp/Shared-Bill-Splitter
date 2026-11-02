const API_BASE = '/api'

export type Home = { id: string; name: string }
export type Member = { id: string; homeId: string; name: string }
export type Share = { id: string; memberId: string; amountCents: number; paidAt: string | null }
export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}
export type Balance = { memberId: string; name: string; outstandingCents: number }

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = (await res.json()) as T & { error?: string }

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed with status ${res.status}`)
  }

  return data
}

async function requestWithHeaders<T>(
  method: string,
  path: string,
  headers: Record<string, string>,
): Promise<T> {
  const allHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...headers }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: allHeaders,
  })

  const data = (await res.json()) as T & { error?: string }

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request failed with status ${res.status}`)
  }

  return data
}

export async function createHome(name: string): Promise<Home> {
  return request<Home>('POST', '/homes', { name })
}

export async function addMember(homeId: string, name: string): Promise<Member> {
  return request<Member>('POST', `/homes/${homeId}/members`, { name })
}

export async function createBill(homeId: string, title: string, totalCents: number): Promise<Bill> {
  return request<Bill>('POST', `/homes/${homeId}/bills`, { title, totalCents })
}

export async function payShare(billId: string, shareId: string): Promise<Share> {
  const idempotencyKey = crypto.randomUUID()
  return requestWithHeaders<Share>('POST', `/bills/${billId}/shares/${shareId}/pay`, {
    'Idempotency-Key': idempotencyKey,
  })
}

export async function getBalances(homeId: string): Promise<{ balances: Balance[] }> {
  return request<{ balances: Balance[] }>('GET', `/homes/${homeId}/balances`)
}
