import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  addMember,
  type Balance,
  type Bill,
  createBill,
  createHome,
  getBalances,
  type Home,
  type Member,
  payShare,
} from '../api'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const [home, setHome] = useState<Home | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])

  const [homeName, setHomeName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [billTitle, setBillTitle] = useState('')
  const [billAmount, setBillAmount] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payingShareId, setPayingShareId] = useState<string | null>(null)

  const clearError = () => setError(null)

  const refreshBalances = useCallback(async (homeId: string) => {
    try {
      const data = await getBalances(homeId)
      setBalances(data.balances)
    } catch (err) {
      console.error('Failed to refresh balances:', err)
    }
  }, [])

  useEffect(() => {
    if (home) {
      refreshBalances(home.id)
    }
  }, [home, refreshBalances])

  const handleCreateHome = async () => {
    if (!homeName.trim()) return
    clearError()
    setLoading(true)
    try {
      const h = await createHome(homeName.trim())
      setHome(h)
      setMembers([])
      setBills([])
      setBalances([])
      setHomeName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create home')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!home || !memberName.trim()) return
    clearError()
    setLoading(true)
    try {
      const m = await addMember(home.id, memberName.trim())
      setMembers((prev) => [...prev, m])
      setMemberName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBill = async () => {
    if (!home || !billTitle.trim() || !billAmount) return
    clearError()
    const cents = Math.round(Number(billAmount) * 100)
    if (Number.isNaN(cents) || cents <= 0) {
      setError('Amount must be a positive number')
      return
    }
    setLoading(true)
    try {
      const b = await createBill(home.id, billTitle.trim(), cents)
      setBills((prev) => [...prev, b])
      setBillTitle('')
      setBillAmount('')
      await refreshBalances(home.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bill')
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async (billId: string, shareId: string) => {
    if (!home) return
    clearError()
    setPayingShareId(shareId)
    try {
      const paid = await payShare(billId, shareId)
      setBills((prev) =>
        prev.map((bill) =>
          bill.id === billId
            ? {
                ...bill,
                shares: bill.shares.map((s) => (s.id === shareId ? paid : s)),
              }
            : bill,
        ),
      )
      await refreshBalances(home.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setPayingShareId(null)
    }
  }

  const getMemberName = (memberId: string) => {
    return members.find((m) => m.id === memberId)?.name ?? memberId
  }

  const formatCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto' }}
    >
      <h1 style={{ marginBottom: 8 }}>Bill Splitter</h1>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <strong>Error:</strong> {error}
          <button
            type="button"
            onClick={clearError}
            style={{
              marginLeft: 12,
              background: 'none',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {!home ? (
        <section>
          <h2>Create a Home</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Home name"
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateHome()}
              style={inputStyle}
            />
            <button type="button" onClick={handleCreateHome} disabled={loading} style={btnStyle}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </section>
      ) : (
        <>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Home: <strong>{home.name}</strong>
          </p>

          {/* Add Member */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Members ({members.length})</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Member name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                style={inputStyle}
              />
              <button type="button" onClick={handleAddMember} disabled={loading} style={btnStyle}>
                {loading ? 'Adding…' : 'Add'}
              </button>
            </div>
            {members.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No members yet. Add members before creating bills.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {members.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Create Bill */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Create a Bill</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Bill title"
                value={billTitle}
                onChange={(e) => setBillTitle(e.target.value)}
                style={{ ...inputStyle, flex: '1 1 200px' }}
              />
              <input
                type="number"
                placeholder="Amount ($)"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                min="0.01"
                step="0.01"
                style={{ ...inputStyle, flex: '0 1 120px' }}
              />
              <button type="button" onClick={handleCreateBill} disabled={loading} style={btnStyle}>
                {loading ? 'Creating…' : 'Split Bill'}
              </button>
            </div>
          </section>

          {/* Balances */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Balances</h2>
            {balances.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No balances to show.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={thStyle}>Member</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.memberId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>{b.name}</td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          fontWeight: 600,
                          color: b.outstandingCents > 0 ? '#dc2626' : '#16a34a',
                        }}
                      >
                        {formatCents(b.outstandingCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Bills */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Bills ({bills.length})</h2>
            {bills.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No bills yet.</p>
            ) : (
              bills.map((bill) => (
                <div
                  key={bill.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
                  >
                    <strong>{bill.title}</strong>
                    <span style={{ color: '#6b7280' }}>{formatCents(bill.totalCents)}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={thSmStyle}>Member</th>
                        <th style={{ ...thSmStyle, textAlign: 'right' }}>Share</th>
                        <th style={{ ...thSmStyle, textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.shares.map((share) => (
                        <tr key={share.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={tdSmStyle}>{getMemberName(share.memberId)}</td>
                          <td style={{ ...tdSmStyle, textAlign: 'right' }}>
                            {formatCents(share.amountCents)}
                          </td>
                          <td style={{ ...tdSmStyle, textAlign: 'right' }}>
                            {share.paidAt ? (
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>Paid ✓</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePay(bill.id, share.id)}
                                disabled={payingShareId === share.id}
                                style={{
                                  ...btnStyle,
                                  padding: '4px 12px',
                                  fontSize: 13,
                                  background: payingShareId === share.id ? '#9ca3af' : '#2563eb',
                                }}
                              >
                                {payingShareId === share.id ? 'Paying…' : 'Pay'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </section>

          {/* Start over */}
          <button
            type="button"
            onClick={() => {
              setHome(null)
              setMembers([])
              setBills([])
              setBalances([])
            }}
            style={{
              ...btnStyle,
              background: '#6b7280',
              marginTop: 16,
            }}
          >
            Start Over
          </button>
        </>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 14,
  flex: 1,
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
}

const h2Style: React.CSSProperties = {
  fontSize: 18,
  marginBottom: 8,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 4px',
  fontSize: 14,
  color: '#6b7280',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 4px',
  fontSize: 14,
}

const thSmStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px',
  fontSize: 13,
  color: '#6b7280',
  fontWeight: 500,
}

const tdSmStyle: React.CSSProperties = {
  padding: '4px',
  fontSize: 13,
}
