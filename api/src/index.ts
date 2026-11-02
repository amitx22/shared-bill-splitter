import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Create a home
app.post('/api/homes', async (c) => {
  const body: unknown = await c.req.json().catch(() => null)

  if (
    typeof body !== 'object' ||
    body === null ||
    !('name' in body) ||
    typeof body.name !== 'string' ||
    body.name.trim().length === 0
  ) {
    return c.json({ error: 'Invalid home name' }, 422)
  }

  const id = crypto.randomUUID()
  const name = body.name.trim()

  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()

  return c.json({ id, name }, 201)
})

// Add a member to a home
app.post('/api/homes/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')
  const body: unknown = await c.req.json().catch(() => null)

  if (
    typeof body !== 'object' ||
    body === null ||
    !('name' in body) ||
    typeof body.name !== 'string' ||
    body.name.trim().length === 0
  ) {
    return c.json({ error: 'Invalid member name' }, 422)
  }

  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

  if (!home) {
    return c.json({ error: 'Home not found' }, 404)
  }

  const nextPosition = await c.env.DB.prepare(
    'SELECT COUNT(*) AS total FROM members WHERE home_id = ?',
  )
    .bind(homeId)
    .first<{ total: number }>()

  const id = crypto.randomUUID()
  const name = body.name.trim()
  const position = nextPosition?.total ?? 0

  await c.env.DB.prepare('INSERT INTO members (id, home_id, name, position) VALUES (?, ?, ?, ?)')
    .bind(id, homeId, name, position)
    .run()

  return c.json({ id, homeId, name }, 201)
})

app.post('/api/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const body: unknown = await c.req.json().catch(() => null)

  // Validate request body
  if (
    typeof body !== 'object' ||
    body === null ||
    !('title' in body) ||
    typeof body.title !== 'string' ||
    body.title.trim().length === 0 ||
    !('totalCents' in body) ||
    typeof body.totalCents !== 'number' ||
    !Number.isSafeInteger(body.totalCents) ||
    body.totalCents <= 0
  ) {
    return c.json({ error: 'Invalid bill details' }, 422)
  }

  // Check whether home exists
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

  if (!home) {
    return c.json({ error: 'Home not found' }, 404)
  }

  // Fetch members in insertion order
  const { results: members } = await c.env.DB.prepare(
    'SELECT id FROM members WHERE home_id = ? ORDER BY position ASC',
  )
    .bind(homeId)
    .all<{ id: string }>()

  if (members.length === 0) {
    return c.json({ error: 'Home has no members' }, 422)
  }

  const billId = crypto.randomUUID()
  const title = body.title.trim()
  const totalCents = body.totalCents

  // Split the amount using integer arithmetic
  const baseAmount = Math.floor(totalCents / members.length)
  const remainder = totalCents % members.length

  const shares = members.map((member, index) => ({
    id: crypto.randomUUID(),
    memberId: member.id,
    amountCents: baseAmount + (index < remainder ? 1 : 0),
    paidAt: null as string | null,
  }))

  // Insert bill and shares together
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO bills (id, home_id, title, total_cents)
       VALUES (?, ?, ?, ?)`,
    ).bind(billId, homeId, title, totalCents),

    ...shares.map((share) =>
      c.env.DB.prepare(
        `INSERT INTO shares
         (id, bill_id, member_id, amount_cents, paid_at)
         VALUES (?, ?, ?, ?, NULL)`,
      ).bind(share.id, billId, share.memberId, share.amountCents),
    ),
  ]

  await c.env.DB.batch(statements)

  return c.json(
    {
      id: billId,
      homeId,
      title,
      totalCents,
      shares,
    },
    201,
  )
})

app.get('/api/homes/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')

  // Check home exists
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()

  if (!home) {
    return c.json({ error: 'Home not found' }, 404)
  }

  // Calculate unpaid balances
  const { results } = await c.env.DB.prepare(`
    SELECT
      m.id AS memberId,
      m.name AS name,
      COALESCE(SUM(s.amount_cents), 0) AS outstandingCents
    FROM members m
    LEFT JOIN shares s
      ON s.member_id = m.id
      AND s.paid_at IS NULL
    LEFT JOIN bills b
      ON b.id = s.bill_id
      AND b.home_id = m.home_id
    WHERE m.home_id = ?
      AND (s.id IS NULL OR b.id IS NOT NULL)
    GROUP BY m.id, m.name, m.position
    ORDER BY m.position ASC
  `)
    .bind(homeId)
    .all<{
      memberId: string
      name: string
      outstandingCents: number
    }>()

  return c.json({ balances: results }, 200)
})

app.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')
  const key = c.req.header('Idempotency-Key')?.trim()

  // 1. Validate idempotency key
  if (!key) {
    return c.json({ error: 'Idempotency-Key is required' }, 400)
  }

  // 2. Find the share belonging to this bill
  const share = await c.env.DB.prepare(`
    SELECT
      s.id,
      s.member_id AS memberId,
      s.amount_cents AS amountCents,
      s.paid_at AS paidAt
    FROM shares s
    INNER JOIN bills b ON b.id = s.bill_id
    WHERE b.id = ? AND s.id = ?
  `)
    .bind(billId, shareId)
    .first<{
      id: string
      memberId: string
      amountCents: number
      paidAt: string | null
    }>()

  if (!share) {
    return c.json({ error: 'Bill or share not found' }, 404)
  }

  // 3. Check whether this key was already used
  const previous = await c.env.DB.prepare(`
    SELECT share_id AS shareId, paid_at AS paidAt
    FROM idempotency_keys
    WHERE idempotency_key = ?
  `)
    .bind(key)
    .first<{ shareId: string; paidAt: string }>()

  if (previous) {
    if (previous.shareId !== shareId) {
      return c.json({ error: 'Idempotency key already used' }, 409)
    }

    return c.json(
      {
        id: share.id,
        memberId: share.memberId,
        amountCents: share.amountCents,
        paidAt: previous.paidAt,
      },
      200,
    )
  }

  // 4. Reject payment if already paid
  if (share.paidAt !== null) {
    return c.json({ error: 'Share already paid' }, 409)
  }

  // 5. Generate payment timestamp
  const paidAt = new Date().toISOString()

  // 6. Atomically update share and save idempotency key
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE shares
        SET paid_at = ?
        WHERE id = ?
          AND bill_id = ?
          AND paid_at IS NULL
      `).bind(paidAt, shareId, billId),

      c.env.DB.prepare(`
        INSERT INTO idempotency_keys
          (idempotency_key, share_id, paid_at)
        SELECT ?, ?, ?
        WHERE changes() = 1
      `).bind(key, shareId, paidAt),
    ])
  } catch {
    // Another request may have used this key concurrently.
    const existing = await c.env.DB.prepare(`
      SELECT share_id AS shareId, paid_at AS paidAt
      FROM idempotency_keys
      WHERE idempotency_key = ?
    `)
      .bind(key)
      .first<{ shareId: string; paidAt: string }>()

    if (existing?.shareId === shareId) {
      return c.json(
        {
          id: share.id,
          memberId: share.memberId,
          amountCents: share.amountCents,
          paidAt: existing.paidAt,
        },
        200,
      )
    }

    if (existing) {
      return c.json({ error: 'Idempotency key already used' }, 409)
    }

    return c.json({ error: 'Payment could not be processed' }, 500)
  }

  // 7. Verify successful payment
  const saved = await c.env.DB.prepare(`
    SELECT share_id AS shareId, paid_at AS paidAt
    FROM idempotency_keys
    WHERE idempotency_key = ?
  `)
    .bind(key)
    .first<{ shareId: string; paidAt: string }>()

  if (saved?.shareId === shareId) {
    return c.json(
      {
        id: share.id,
        memberId: share.memberId,
        amountCents: share.amountCents,
        paidAt: saved.paidAt,
      },
      200,
    )
  }

  return c.json({ error: 'Share already paid' }, 409)
})

// Get complete home data (Home + Members + Bills + Shares)
app.get('/api/homes/:homeId', async (c) => {
  const homeId = c.req.param('homeId')

  const home = await c.env.DB.prepare(
    'SELECT id, name FROM homes WHERE id = ?',
  )
    .bind(homeId)
    .first<{ id: string; name: string }>()

  if (!home) {
    return c.json({ error: 'Home not found' }, 404)
  }

  const { results: members } = await c.env.DB.prepare(`
    SELECT id, name
    FROM members
    WHERE home_id = ?
    ORDER BY position ASC
  `)
    .bind(homeId)
    .all<{ id: string; name: string }>()

  const { results: bills } = await c.env.DB.prepare(`
    SELECT id, title, total_cents AS totalCents
    FROM bills
    WHERE home_id = ?
    ORDER BY rowid ASC
  `)
    .bind(homeId)
    .all<{
      id: string
      title: string
      totalCents: number
    }>()

  const { results: shares } = await c.env.DB.prepare(`
    SELECT
      s.id,
      s.bill_id AS billId,
      s.member_id AS memberId,
      s.amount_cents AS amountCents,
      s.paid_at AS paidAt
    FROM shares s
    INNER JOIN bills b ON b.id = s.bill_id
    WHERE b.home_id = ?
  `)
    .bind(homeId)
    .all<{
      id: string
      billId: string
      memberId: string
      amountCents: number
      paidAt: string | null
    }>()

  const completeBills = bills.map(bill => ({
    ...bill,
    shares: shares
      .filter(share => share.billId === bill.id)
      .map(({ billId, ...share }) => share),
  }))

  return c.json({
    home,
    members,
    bills: completeBills,
  })
})

export default app
