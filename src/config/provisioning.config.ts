export interface ProvisioningConfig {
  NATS_URL: string;
  NATS_CREDENTIALS: string;
  NATS_REQUEST_TIMEOUT_MS: number;
  NATS_MAX_RETRIES: number;
  CA_CERTS_PATH: string;
  CERT_TTL_DAYS: number;
  PORT: number;
  NATS_TLS_CA?: string;
  NATS_TLS_CERT?: string;
  NATS_TLS_KEY?: string;
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const loadConfig = (): ProvisioningConfig => ({
  NATS_URL: required('NATS_URL'),
  NATS_CREDENTIALS: required('NATS_CREDENTIALS'),
  NATS_REQUEST_TIMEOUT_MS: Number.parseInt(
    process.env.NATS_REQUEST_TIMEOUT_MS || '5000',
    10,
  ),
  NATS_MAX_RETRIES: Number.parseInt(process.env.NATS_MAX_RETRIES || '3', 10),
  CA_CERTS_PATH: process.env.CA_CERTS_PATH || '/certs',
  CERT_TTL_DAYS: Number.parseInt(process.env.CERT_TTL_DAYS || '90', 10),
  PORT: Number.parseInt(process.env.PORT || '3004', 10),
  NATS_TLS_CA: process.env.NATS_TLS_CA,
  NATS_TLS_CERT: process.env.NATS_TLS_CERT,
  NATS_TLS_KEY: process.env.NATS_TLS_KEY,
});
