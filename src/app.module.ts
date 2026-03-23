import { Module } from '@nestjs/common';
import { CryptoModule } from './crypto/crypto.module';
import { ConfigModule } from './config/config.module';
import { CAModule } from './ca/ca.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule, CryptoModule, CAModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
