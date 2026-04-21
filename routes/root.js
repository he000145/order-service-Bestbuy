'use strict'

const orders = []
const allowedStatuses = new Set(['pending', 'processing', 'completed'])
const numericStatuses = new Map([
  [0, 'pending'],
  [1, 'processing'],
  [2, 'completed']
])
let nextOrderId = 1001

function toNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isNonEmptyObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeItems(orderPayload) {
  let sourceItems = []

  if (Array.isArray(orderPayload.items)) {
    sourceItems = orderPayload.items
  } else if (Array.isArray(orderPayload.cart)) {
    sourceItems = orderPayload.cart
  } else if (isNonEmptyObject(orderPayload.cart) && Array.isArray(orderPayload.cart.items)) {
    sourceItems = orderPayload.cart.items
  }

  return sourceItems
    .filter(isNonEmptyObject)
    .map((item) => {
      const normalizedItem = { ...item }
      const quantity = toNumber(item.quantity)
      const price = toNumber(item.price ?? item.unitPrice)

      normalizedItem.quantity = quantity && quantity > 0 ? quantity : 1

      if (price !== null) {
        normalizedItem.price = roundCurrency(price)
      }

      return normalizedItem
    })
}

function normalizeStatus(status) {
  if (typeof status === 'number' && Number.isInteger(status) && numericStatuses.has(status)) {
    return numericStatuses.get(status)
  }

  if (typeof status !== 'string') {
    return 'pending'
  }

  const normalizedStatus = status.trim().toLowerCase()
  return allowedStatuses.has(normalizedStatus) ? normalizedStatus : 'pending'
}

function isSupportedStatus(status) {
  if (typeof status === 'number') {
    return Number.isInteger(status) && numericStatuses.has(status)
  }

  if (typeof status === 'string') {
    return allowedStatuses.has(status.trim().toLowerCase())
  }

  return false
}

function createOrderId(requestedId) {
  if (requestedId !== undefined && requestedId !== null && requestedId !== '') {
    const normalizedId = String(requestedId)

    if (!orders.some((order) => order.id === normalizedId)) {
      return normalizedId
    }
  }

  let generatedId = String(nextOrderId++)
  while (orders.some((order) => order.id === generatedId)) {
    generatedId = String(nextOrderId++)
  }

  return generatedId
}

function calculateTotal(items, providedTotal) {
  const normalizedTotal = toNumber(providedTotal)

  if (normalizedTotal !== null && normalizedTotal >= 0) {
    return roundCurrency(normalizedTotal)
  }

  const computedTotal = items.reduce((sum, item) => {
    const price = toNumber(item.price)
    const quantity = toNumber(item.quantity) || 1

    if (price === null || price < 0) {
      return sum
    }

    return sum + (price * quantity)
  }, 0)

  return roundCurrency(computedTotal)
}

function buildOrder(orderPayload) {
  const items = normalizeItems(orderPayload)
  const customerObject = isNonEmptyObject(orderPayload.customer) ? orderPayload.customer : null
  const customerName = orderPayload.customerName ||
    (typeof orderPayload.customer === 'string' ? orderPayload.customer : customerObject?.name)
  const customerId = orderPayload.customerId || customerObject?.id || customerObject?.customerId
  const now = new Date().toISOString()

  return {
    ...orderPayload,
    id: createOrderId(orderPayload.id),
    customerId,
    customerName,
    items,
    total: calculateTotal(items, orderPayload.total),
    status: normalizeStatus(orderPayload.status),
    createdAt: orderPayload.createdAt || now,
    updatedAt: now
  }
}

function findOrderById(id) {
  return orders.find((order) => order.id === id)
}

module.exports = async function (fastify, opts) {
  fastify.post('/', async function (request, reply) {
    const orderPayload = isNonEmptyObject(request.body) ? request.body : null

    if (!orderPayload) {
      return reply.code(400).send({ error: 'Order payload is required.' })
    }

    const order = buildOrder(orderPayload)

    if (order.items.length === 0) {
      return reply.code(400).send({ error: 'At least one order item is required.' })
    }

    orders.unshift(order)
    fastify.sendMessage(Buffer.from(JSON.stringify(order)))

    return reply.code(201).send(order)
  })

  fastify.get('/orders', async function (request, reply) {
    return orders
  })

  fastify.get('/orders/:id', async function (request, reply) {
    const order = findOrderById(request.params.id)

    if (!order) {
      return reply.code(404).send({ error: 'Order not found.' })
    }

    return order
  })

  fastify.patch('/orders/:id', async function (request, reply) {
    const order = findOrderById(request.params.id)
    const updates = isNonEmptyObject(request.body) ? request.body : null

    if (!order) {
      return reply.code(404).send({ error: 'Order not found.' })
    }

    if (!updates || updates.status === undefined) {
      return reply.code(400).send({ error: 'A status value is required.' })
    }

    if (!isSupportedStatus(updates.status)) {
      return reply.code(400).send({ error: 'Status must be pending, processing, or completed.' })
    }

    const nextStatus = normalizeStatus(updates.status)
    order.status = nextStatus
    order.updatedAt = new Date().toISOString()

    return order
  })

  fastify.get('/health', async function (request, reply) {
    const appVersion = process.env.APP_VERSION || '0.1.0'
    return { status: 'ok', version: appVersion }
  })
}
