# provisioning-service

### Informazioni tecniche per la generazione OpenAPI

nei @ApiProperty ci sta example e description su ogni campo (questi file sono visibili in src\provisioning\dto\.)

#### Endpoint e Metodo

- URL servizio (NestJS): /provision/onboard
- URL esposta da Nginx: /api/provision/onboard
- Metodo: POST
- Porta: 3004
- Auth: tramite: factory_id e factory_key nel body

#### Struttura del Payload

- factory_id: stringa che identifica il gateway
- factory_key: stringa segreta monouso che verrà validata tramite bcrypt nel Management API
- csr: stringa in formato PEM che deve iniziare obbligatoriamente con "-----BEGIN CERTIFICATE REQUEST-----"

#### Schema di risposta

- 201 Created
- certificate: certificato firmato
- aeskey: la chiave AES-256 in base64

#### Errori

- 400: csr scritta male
	- body: {"error":"MALFORMED_CSR"}
- 401: chiavi di fabbrica errate
	- body: {"error":"INVALID_CREDENTIALS"}
- 409: gateway gia registrato / gia provisioned
	- body: {"error":"ALREADY_PROVISIONED"}
- 503: management api non raggiungibile via nats (retry/timeout esauriti)
	- body: {"error":"SERVICE_UNAVAILABLE"}

