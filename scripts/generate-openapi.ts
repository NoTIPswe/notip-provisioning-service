import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { ProvisioningController } from '../src/provisioning/provisioning.controller';

const OUTPUT_DIR = 'api-contracts/openapi';
const OUTPUT_FILE = `${OUTPUT_DIR}/openapi.yaml`;

async function generateOpenApi(): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProvisioningController],
    providers: [{ provide: 'OnboardGateway', useValue: {} }],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const config = new DocumentBuilder()
    .setTitle('NoTIP Provisioning Service')
    .setDescription('NoTIP Provisioning Service OpenAPI specification')
    .setVersion(process.env.npm_package_version ?? '1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const yamlString = yaml.dump(document, { noRefs: true });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, yamlString, 'utf8');

  await app.close();
  console.log(`OpenAPI spec written to ${OUTPUT_FILE}`);
}

generateOpenApi().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
