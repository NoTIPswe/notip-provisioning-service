# notip-provisioning-service
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=NoTIPswe_notip-provisioning-service&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=NoTIPswe_notip-provisioning-service)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=NoTIPswe_notip-provisioning-service&metric=coverage)](https://sonarcloud.io/summary/new_code?id=NoTIPswe_notip-provisioning-service)

NestJS microservice responsible for onboarding IoT gateways into the NoTIP platform. It validates factory credentials over NATS, signs a CSR with an internal CA, generates an AES-256 key, and notifies the Management API to mark the gateway as provisioned.

**Version:** 1.1.1 — **Port:** 3004 (default)

---

## Architecture overview

```
Gateway (HTTP)
     │
     ▼
POST /provision/onboard
     │
     ├─► NATS request-reply: internal.mgmt.factory.validate  → management-api
     ├─► node-forge: sign CSR with internal CA
     ├─► AES-256 key generation
     └─► NATS request-reply: internal.mgmt.provisioning.complete → management-api
```

### Modules

| Module | Responsibility |
|---|---|
| `ConfigModule` | Loads and validates environment variables |
| `CAModule` | Loads CA key/cert from disk, signs CSR via node-forge |
| `CryptoModule` | Generates random AES-256 keys |
| `NATSModule` | Request-reply client with retry/timeout; factory validator and provisioning completer |
| `ProvisioningModule` | HTTP controller, orchestration service, audit log interceptor, exception filter |
| `MetricsModule` | Prometheus metrics endpoint (`GET /metrics`) and global interceptor |

---

## HTTP API

### `POST /provision/onboard`

Nginx exposes this as `/api/provision/onboard`.

#### Request body

```json
{
  "credentials": {
    "factoryId": "GW-NOTIP-2026-001",
    "factoryKey": "super-secret-factory-key"
  },
  "csr": "-----BEGIN CERTIFICATE REQUEST-----\n...\n-----END CERTIFICATE REQUEST-----",
  "sendFrequencyMs": 5000,
  "firmwareVersion": "1.0.0"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `credentials.factoryId` | string | yes | Opaque gateway identifier |
| `credentials.factoryKey` | string | yes | One-time pre-shared secret, validated via bcrypt in Management API |
| `csr` | string (PEM) | yes | Must start with `-----BEGIN CERTIFICATE REQUEST-----` |
| `sendFrequencyMs` | integer ≥ 1 | yes | Telemetry send frequency in milliseconds |
| `firmwareVersion` | string | no | Gateway firmware version |

#### Response — `201 Created`

```json
{
  "certPem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "aesKey": "<base64-encoded-aes-256-key>",
  "identity": {
    "gatewayId": "gw-1",
    "tenantId": "tenant-1"
  },
  "sendFrequencyMs": 5000
}
```

| Field | Description |
|---|---|
| `certPem` | Leaf certificate signed by the internal CA (PEM) |
| `aesKey` | Randomly generated AES-256 key, Base64-encoded |
| `identity.gatewayId` | Gateway UUID assigned by Management API |
| `identity.tenantId` | Tenant UUID |
| `sendFrequencyMs` | Confirmed telemetry frequency |

#### Error responses

| Status | Body | Cause |
|---|---|---|
| 400 | `{"error":"MALFORMED_CSR"}` | CSR is not valid PEM |
| 401 | `{"error":"INVALID_CREDENTIALS"}` | Factory credentials rejected by Management API |
| 409 | `{"error":"ALREADY_PROVISIONED"}` | Gateway was already provisioned |
| 503 | `{"error":"SERVICE_UNAVAILABLE"}` | NATS request timed out / retries exhausted |

### `GET /metrics`

Returns Prometheus metrics in text format.

---

## NATS contracts

The service communicates with **management-api** exclusively over NATS request-reply (no HTTP). Full message schemas are in [api-contracts/asyncapi/nats-contracts.yaml](api-contracts/asyncapi/nats-contracts.yaml).

| Subject | Direction | Purpose |
|---|---|---|
| `internal.mgmt.factory.validate` | requester | Validate factory credentials, receive `gateway_id` / `tenant_id` |
| `internal.mgmt.provisioning.complete` | requester | Persist AES key, mark gateway as provisioned |
| `log.audit.{tenantId}` | publisher | Emit structured audit log entries |

**Retry policy:** up to `NATS_MAX_RETRIES` total attempts, exponential backoff `2^(attempt-1)` seconds (1 s, 2 s, …). Timeout per attempt: `NATS_REQUEST_TIMEOUT_MS`. On exhaustion → 503.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NATS_URL` | yes | — | NATS server URL (e.g. `tls://nats:4222`) |
| `NATS_CREDENTIALS` | yes | — | NATS auth string: `user:pass` for basic auth, or a bare token |
| `NATS_REQUEST_TIMEOUT_MS` | no | `5000` | Per-attempt request timeout |
| `NATS_MAX_RETRIES` | no | `3` | Max retry attempts for NATS requests |
| `NATS_TLS_CA` | no | — | Path to NATS TLS CA certificate |
| `NATS_TLS_CERT` | no | — | Path to NATS TLS client certificate |
| `NATS_TLS_KEY` | no | — | Path to NATS TLS client key |
| `CA_CERTS_PATH` | no | `/certs` | Directory containing the CA certificate |
| `CA_KEY_PATH` | no | — | Path to the CA private key file |
| `CERT_TTL_DAYS` | no | `90` | Signed certificate validity in days |
| `PORT` | no | `3004` | HTTP listen port |

---

## Prometheus metrics

| Metric | Type | Description |
|---|---|---|
| `provisioning_attempts_total` | Counter | Total `POST /provision/onboard` requests |
| `provisioning_successes_total` | Counter | Successfully completed provisionings |
| `provisioning_failures_total{reason}` | Counter | Failed provisionings labelled by reason |
| `csr_signing_duration_ms` | Histogram | Duration of CSR signing (node-forge) |
| `nats_validate_duration_ms` | Histogram | Duration of `internal.mgmt.factory.validate` round-trip |
| `nats_complete_duration_ms` | Histogram | Duration of `internal.mgmt.provisioning.complete` round-trip |
| `nats_retries_total` | Counter | Total NATS retry attempts |

---

## Development

```bash
# Install dependencies
npm ci

# Start in watch mode
npm run start:dev

# Run unit tests
npm test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Type-check without emitting
npm run typecheck

# Lint
npm run lint:check

# Generate OpenAPI spec
npm run generate:openapi

# Fetch external OpenAPI contracts (management-api, data-api)
npm run fetch:openapi

# Fetch AsyncAPI contracts
npm run fetch:asyncapi
```

### API contract files

| File | Description |
|---|---|
| [api-contracts/openapi/openapi.yaml](api-contracts/openapi/openapi.yaml) | This service's OpenAPI spec |
| [api-contracts/openapi/management-api-openapi.yaml](api-contracts/openapi/management-api-openapi.yaml) | Management API contract (fetched) |
| [api-contracts/openapi/data-api-openapi.yaml](api-contracts/openapi/data-api-openapi.yaml) | Data API contract (fetched) |
| [api-contracts/asyncapi/nats-contracts.yaml](api-contracts/asyncapi/nats-contracts.yaml) | Authoritative NATS subject definitions |

---

## Docker

```bash
docker build -t notip-provisioning-service .
docker run -p 3004:3000 \
  -e NATS_URL=tls://nats:4222 \
  -e NATS_CREDENTIALS=... \
  notip-provisioning-service
```

The production image exposes port **3000** internally. Note: the Dockerfile declares a healthcheck on `GET /health` but no health endpoint is currently implemented — requests to that path will return 404.
