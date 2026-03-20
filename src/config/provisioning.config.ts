export interface ProvisioningConfig {
  NATS_URL: string; // URL del server NATS
  NATS_CREDENTIALS: string; // Username:password per l'autenticazione NATS
  NATS_REQUEST_TIMEOUT_MS: number; // Timeout per le chiamate Request-Reply (default 5000)
  NATS_MAX_RETRIES: number; // Numero massimo di tentativi in caso di errore (default 3)
  CA_CERTS_PATH: string; // Percorso dove verranno salvati i certificati (default /certs)
  CERT_TTL_DAYS: number; // Durata del certificato del dispositivo (default 90 giorni)
  PORT: number; // Porta su cui gira questo servizio (3004)
}

export const loadConfig = (): ProvisioningConfig => ({
  NATS_URL: process.env.NATS_URL || 'nats://nats:4222',
  NATS_CREDENTIALS: process.env.NATS_CREDENTIALS || 'user:pass',
  NATS_REQUEST_TIMEOUT_MS: Number.parseInt(
    process.env.NATS_REQUEST_TIMEOUT_MS || '5000',
    10,
  ),
  NATS_MAX_RETRIES: Number.parseInt(process.env.NATS_MAX_RETRIES || '3', 10),
  CA_CERTS_PATH: process.env.CA_CERTS_PATH || '/certs',
  CERT_TTL_DAYS: Number.parseInt(process.env.CERT_TTL_DAYS || '90', 10),
  PORT: Number.parseInt(process.env.PORT || '3004', 10),
});
