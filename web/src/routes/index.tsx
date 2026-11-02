import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: Home,
})

type Member = {
  id: string
  name: string
}

type Share = {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

type Bill = {
  id: string
  title: string
  totalCents: number
  shares: Share[]
}

type Balance = {
  memberId: string
  name: string
  outstandingCents: number
}

type HomeData = {
  home: { id: string; name: string }
  members: Member[]
  bills: Bill[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const text = await response.text()
  let data: unknown = null

  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch {
    throw new Error('Invalid response received from server')
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `Request failed: ${response.status}`

    throw new Error(errorMessage)
  }

  return data as T
}

function Home() {
  const [homeName, setHomeName] = useState('')
  const [homeId, setHomeId] = useState('')
  const [memberName, setMemberName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [billTitle, setBillTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Restore saved home and its data after page refresh
  useEffect(() => {
    if (!homeId) {
      const savedHomeId = localStorage.getItem('splitmate-home-id')

      if (savedHomeId) {
        setHomeId(savedHomeId)
      }

      return
    }

    let cancelled = false

    async function loadHomeData() {
      try {
        setLoading(true)

        const data = await api<HomeData>(`/api/homes/${homeId}`)

        if (cancelled) return

        setHomeName(data.home.name)
        setMembers(data.members)
        setBills(data.bills)

        const balanceData = await api<{ balances: Balance[] }>(
          `/api/homes/${homeId}/balances`
        )

        if (cancelled) return

        setBalances(balanceData.balances)
        setMessage('Home data loaded successfully!')
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : 'Failed to load home'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadHomeData()

    return () => {
      cancelled = true
    }
  }, [homeId])

  const totalCents = bills.reduce(
    (sum, bill) => sum + bill.totalCents,
    0
  )

  const money = (cents: number) =>
    `₹${(cents / 100).toFixed(2)}`

  async function createHome() {
    if (!homeName.trim()) {
      setMessage('Enter home name')
      return
    }

    try {
      setLoading(true)

      const data = await api<{ id: string; name: string }>(
        '/api/homes',
        {
          method: 'POST',
          body: JSON.stringify({ name: homeName }),
        }
      )

      setHomeId(data.id)
      setHomeName(data.name)

      // Save home ID for future visits
      localStorage.setItem('splitmate-home-id', data.id)

      setMessage(`Home "${data.name}" created successfully!`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function refreshBalances() {
    if (!homeId) return

    const data = await api<{ balances: Balance[] }>(
      `/api/homes/${homeId}/balances`
    )

    setBalances(data.balances)
  }

  async function addMember() {
    if (!homeId) {
      setMessage('Create your home first')
      return
    }

    if (!memberName.trim()) {
      setMessage('Enter member name')
      return
    }

    try {
      setLoading(true)

      const data = await api<Member>(
        `/api/homes/${homeId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ name: memberName }),
        }
      )

      setMembers(prev => [...prev, data])
      setMemberName('')

      await refreshBalances()
      setMessage(`${data.name} added successfully!`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function addBill() {
    const value = Number(amount)

    if (!homeId) {
      setMessage('Create your home first')
      return
    }

    if (
      !billTitle.trim() ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !Number.isSafeInteger(Math.round(value * 100))
    ) {
      setMessage('Enter valid bill details')
      return
    }

    try {
      setLoading(true)

      const data = await api<Bill>(
        `/api/homes/${homeId}/bills`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: billTitle,
            totalCents: Math.round(value * 100),
          }),
        }
      )

      setBills(prev => [...prev, data])
      setBillTitle('')
      setAmount('')

      await refreshBalances()
      setMessage('Bill created and split successfully!')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function payShare(billId: string, shareId: string) {
    try {
      setLoading(true)

      const data = await api<{
        id: string
        paidAt: string
      }>(`/api/bills/${billId}/shares/${shareId}/pay`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
      })

      setBills(prev =>
        prev.map(bill =>
          bill.id === billId
            ? {
                ...bill,
                shares: bill.shares.map(share =>
                  share.id === shareId
                    ? { ...share, paidAt: data.paidAt }
                    : share
                ),
              }
            : bill
        )
      )

      await refreshBalances()
      setMessage('Payment marked as paid!')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Payment failed'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1000, margin: 'auto' }}>
        <header style={{ marginBottom: 30 }}>
          <h1>SplitMate 💸</h1>
          <p>Manage shared expenses with ease.</p>
        </header>

        {message && (
          <p style={messageStyle} role="status">
            {message}
          </p>
        )}

        {loading && <p>Loading...</p>}

        {/* Create Home */}
        <section style={cardStyle}>
          <h2>Create Your Home</h2>

          <input
            value={homeName}
            onChange={e => setHomeName(e.target.value)}
            placeholder="Enter home name"
            style={inputStyle}
            disabled={!!homeId || loading}
          />

          <button
            onClick={createHome}
            style={buttonStyle}
            disabled={loading || !!homeId}
          >
            {homeId ? 'Home Created ✓' : 'Create Home'}
          </button>

          {homeId && (
            <p style={{ fontSize: 12, color: '#64748b' }}>
              Home ID: {homeId}
            </p>
          )}
        </section>

        {/* Members */}
        <section style={cardStyle}>
          <h2>Members ({members.length})</h2>

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
              placeholder="Member name"
              style={inputStyle}
              disabled={loading || !homeId}
            />

            <button
              onClick={addMember}
              style={buttonStyle}
              disabled={loading || !homeId}
            >
              Add
            </button>
          </div>

          {members.length === 0 ? (
            <p>No members added yet.</p>
          ) : (
            members.map(member => (
              <p key={member.id}>👤 {member.name}</p>
            ))
          )}
        </section>

        {/* Add Bill */}
        <section style={cardStyle}>
          <h2>Add a Bill</h2>

          <input
            value={billTitle}
            onChange={e => setBillTitle(e.target.value)}
            placeholder="Bill title"
            style={inputStyle}
            disabled={loading || !homeId}
          />

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount in ₹"
            style={inputStyle}
            disabled={loading || !homeId}
          />

          <button
            onClick={addBill}
            style={buttonStyle}
            disabled={loading || !homeId || members.length === 0}
          >
            Add Bill
          </button>

          {homeId && members.length === 0 && (
            <p>Add at least one member before creating a bill.</p>
          )}
        </section>

        {/* Expense Summary */}
        <section style={cardStyle}>
          <h2>Expense Summary</h2>

          <h1 style={{ color: '#4f46e5', fontSize: 36 }}>
            {money(totalCents)}
          </h1>

          <p>Total Bills: {bills.length}</p>
          <p>Total Members: {members.length}</p>

          {bills.length === 0 ? (
            <p>No bills added yet.</p>
          ) : (
            bills.map(bill => (
              <div key={bill.id} style={billStyle}>
                <h3>{bill.title}</h3>
                <h2>{money(bill.totalCents)}</h2>

                <h4>Member-wise Split</h4>

                {bill.shares.map(share => {
                  const member = members.find(
                    m => m.id === share.memberId
                  )

                  return (
                    <div key={share.id} style={shareStyle}>
                      <div>
                        <strong>{member?.name || 'Member'}</strong>
                        <p style={{ margin: '5px 0' }}>
                          {money(share.amountCents)}
                        </p>
                      </div>

                      {share.paidAt ? (
                        <span style={{ color: 'green' }}>
                          ✓ Paid
                        </span>
                      ) : (
                        <button
                          style={payButtonStyle}
                          disabled={loading}
                          onClick={() => payShare(bill.id, share.id)}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </section>

        {/* Balances */}
        <section style={cardStyle}>
          <h2>Outstanding Balances</h2>

          {balances.length === 0 ? (
            <p>No outstanding balances yet.</p>
          ) : (
            balances.map(balance => (
              <div key={balance.memberId} style={shareStyle}>
                <strong>{balance.name}</strong>
                <strong>{money(balance.outstandingCents)}</strong>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

const mainStyle = {
  minHeight: '100vh',
  background: '#f4f6fb',
  padding: 32,
  fontFamily: 'Arial, sans-serif',
  color: '#172033',
}

const cardStyle = {
  background: '#fff',
  padding: 24,
  borderRadius: 16,
  marginBottom: 24,
}

const messageStyle = {
  background: '#e0f2fe',
  padding: 12,
  borderRadius: 8,
}

const inputStyle = {
  padding: 12,
  border: '1px solid #dbe1ea',
  borderRadius: 8,
  margin: '8px 0',
  width: '100%',
  boxSizing: 'border-box' as const,
}

const buttonStyle = {
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '12px 20px',
  cursor: 'pointer',
}

const billStyle = {
  background: '#f8fafc',
  padding: 20,
  borderRadius: 12,
  marginTop: 16,
}

const shareStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid #e2e8f0',
}

const payButtonStyle = {
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 14px',
  cursor: 'pointer',
}