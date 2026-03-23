import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import type { CARepository } from './interfaces/ca-repository.interface';

@Injectable()
export class CAInitializerService implements OnModuleInit {
  private readonly logger = new Logger(CAInitializerService.name); //per manutenzione

  constructor(
    @Inject('CARepository') private readonly caRepository: CARepository,
  ) {}

  async onModuleInit() {
    this.logger.log('Controllo stato della Certificate Authority...');

    try {
      const exists = await this.caRepository.caExists();

      if (exists) {
        this.logger.log(
          'CA esistente trovata nel volume. Caricamento in corso...',
        );
        await this.caRepository.load();
      } else {
        this.logger.warn(
          'Nessuna CA trovata. Generazione nuova Root CA e certificati NATS...',
        );
        await this.caRepository.initialize();
        this.logger.log('Inizializzazione completata con successo.');
      }
    } catch (error) {
      this.logger.error(
        "Errore critico durante l'inizializzazione della CA:",
        error,
      );
      throw error;
    }
  }
}
