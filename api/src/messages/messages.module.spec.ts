// Mock TypeORM before any imports to avoid database connection attempts
jest.mock('@nestjs/typeorm', () => {
  const real = jest.requireActual('@nestjs/typeorm');
  return {
    ...real,
    TypeOrmModule: {
      ...real.TypeOrmModule,
      forFeature: jest.fn().mockReturnValue({
        module: class MockTypeOrmFeatureModule {},
        global: false,
        providers: [],
        exports: [],
        imports: [],
      }),
    },
  };
});

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MessagesModule } from './messages.module';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';

describe('MessagesModule', () => {
  it('compiles and invokes JwtModule factory with ConfigService', async () => {
    const mockConfigService = { get: jest.fn().mockReturnValue('test-jwt-secret') };

    const moduleRef = await Test.createTestingModule({
      imports: [MessagesModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .overrideProvider(MessagesService)
      .useValue({})
      .overrideProvider(MessagesGateway)
      .useValue({ server: null, emitNewMessage: jest.fn() })
      .compile();

    expect(moduleRef).toBeDefined();
    // factory function in JwtModule.registerAsync uses ConfigService.get
    expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
  });
});
