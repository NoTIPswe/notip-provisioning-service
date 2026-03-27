import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import type { CARepository } from './interfaces/ca-repository.interface';
import { CAMaterial } from './model/ca-material';
import { CAProvider } from './interfaces/ca-provider.interface';
import { CAUninitializedError } from './model/errors';

@Injectable()
export class CAInitializerService implements OnModuleInit, CAProvider {
  private readonly logger = new Logger(CAInitializerService.name);
  private caMaterial: CAMaterial | null = null;

  constructor(
    @Inject('CARepository') private readonly caRepository: CARepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeCA();
  }

  async initializeCA(): Promise<void> {
    this.logger.log('Checking Certificate Authority state...');

    try {
      const exists = await this.caRepository.caExists();

      if (exists) {
        this.caMaterial = await this.caRepository.load();
        this.logger.log('Existing CA loaded from volume');
      } else {
        this.caMaterial = await this.caRepository.initialize();
        this.logger.warn(
          'No CA found. Generated new CA and NATS server certificates',
        );
      }
    } catch (error) {
      this.logger.error('Critical CA initialization error');
      throw new CAUninitializedError(
        'CAFileStore cannot read or generate a valid CA',
        error,
      );
    }
  }

  getCA(): CAMaterial {
    if (!this.caMaterial) {
      throw new CAUninitializedError('CA is not initialized in memory');
    }

    return this.caMaterial;
  }
}
