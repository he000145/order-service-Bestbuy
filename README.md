# order-service-Bestbuy

`order-service-Bestbuy` is the order backend for the CST8915 final project. It is a lightweight Fastify service for a Best Buy-inspired electronics storefront and is designed to work with the `store-front` app now, with room for later `store-admin` and order-processing integrations.

## What this service does

- Accepts order submissions from the storefront.
- Normalizes and stores orders in memory for demo use.
- Assigns an order `id`, `status`, timestamps, and a consistent `total`.
- Exposes simple order lookup endpoints for later admin and processing workflows.
- Optionally forwards created orders to a RabbitMQ or Azure Service Bus queue if queue configuration is provided.

## Current order behavior

- `POST /` remains the main storefront submission endpoint.
- Orders default to `pending` status.
- Supported statuses are `pending`, `processing`, and `completed`.
- The service keeps the submitted payload shape as much as possible and preserves common fields such as `customerId`, `customerName`, `items`, `total`, `status`, and `createdAt`.
- For compatibility, the service accepts order items from `items`, `cart`, or `cart.items`, then stores the normalized result on `items`.
- Orders are stored in memory only, which keeps the project simple for demos. Restarting the service clears the order list unless an external queue or downstream processor is used.

## API overview

### `POST /`
Create a new order.

Example request body:

```json
{
  "customerId": "CST8915-1001",
  "customerName": "Alex Johnson",
  "items": [
    {
      "productId": "BBY-LAPTOP-001",
      "productName": "Lenovo IdeaPad 15 Laptop",
      "quantity": 1,
      "price": 799.99
    },
    {
      "productId": "BBY-MOUSE-014",
      "productName": "Logitech Wireless Mouse",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "total": 859.97
}
```

Returns `201 Created` with the stored order object.

### `GET /orders`

Return all submitted orders currently held in memory.

### `GET /orders/:id`

Return a single order by id.

### `PATCH /orders/:id`

Update an order status.

Example request body:

```json
{
  "status": "processing"
}
```

### `GET /health`

Basic health endpoint. Returns service status and app version.

## Configuration

The service can run with no queue configuration at all. In that mode, it accepts and stores orders in memory only.

### Core runtime

- `APP_VERSION`: optional application version returned by `GET /health`

### Optional RabbitMQ configuration

- `ORDER_QUEUE_HOSTNAME`
- `ORDER_QUEUE_PORT`
- `ORDER_QUEUE_USERNAME`
- `ORDER_QUEUE_PASSWORD`
- `ORDER_QUEUE_NAME`
- `ORDER_QUEUE_TRANSPORT`
- `ORDER_QUEUE_RECONNECT_LIMIT`

If these values are present, newly created orders are also published to the configured queue.

### Optional Azure Service Bus configuration

- `USE_WORKLOAD_IDENTITY_AUTH=true`
- `AZURE_SERVICEBUS_FULLYQUALIFIEDNAMESPACE`
- `ORDER_QUEUE_NAME`

If workload identity is enabled, created orders are sent to Azure Service Bus instead of local RabbitMQ credentials.

## Local run instructions

Install dependencies if you do not already have them:

```bash
npm install
```

Run the service in development mode:

```bash
npm run dev
```

Run the service in standard mode:

```bash
npm start
```

The API listens on port `3000` by default.

## Build instructions

If you want to build the container image locally:

```bash
docker build -t order-service-bestbuy .
```

## Docker instructions

Run the API container:

```bash
docker run -p 3000:3000 --name order-service-bestbuy order-service-bestbuy
```

If you want a local RabbitMQ instance for queue-based demos,  a `docker-compose.yml` file is included:

```bash
docker compose up
```

This starts RabbitMQ with the AMQP 1.0 plugin enabled so created orders can be published to the `orders` queue when the related environment variables are configured.

## Quick testing

- Use [`test-order-service.http`](./test-order-service.http) with the VS Code REST Client extension.
- Submit a sample electronics order with `POST /`.
- Check the stored orders with `GET /orders`.
- Update an order status with `PATCH /orders/:id`.
- Call `GET /health` to confirm the service is running.

## Project notes

- This service is intentionally lightweight and demo-friendly.
- No database or auth layer has been added.
- Queue publishing is optional and does not prevent local demo use when queue credentials are absent.
