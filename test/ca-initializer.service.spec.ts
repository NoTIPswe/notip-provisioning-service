import { CAInitializerService } from '../src/ca/ca-initializer.service';
import { CAMaterial } from '../src/ca/model/ca-material';
import { CAUninitializedError } from '../src/ca/model/errors';

describe('CAInitializerService', () => {
  const loadedMaterial = new CAMaterial('loaded-key', 'loaded-cert');
  const initializedMaterial = new CAMaterial('init-key', 'init-cert');

  it('loads existing CA when repository indicates material exists', async () => {
    const repo = {
      caExists: jest.fn().mockResolvedValue(true),
      load: jest.fn().mockResolvedValue(loadedMaterial),
      initialize: jest.fn(),
    };

    const service = new CAInitializerService(repo as never);
    await service.initializeCA();

    expect(repo.caExists).toHaveBeenCalledTimes(1);
    expect(repo.load).toHaveBeenCalledTimes(1);
    expect(repo.initialize).not.toHaveBeenCalled();
    expect(service.getCA()).toBe(loadedMaterial);
  });

  it('initializes a new CA when material does not exist', async () => {
    const repo = {
      caExists: jest.fn().mockResolvedValue(false),
      load: jest.fn(),
      initialize: jest.fn().mockResolvedValue(initializedMaterial),
    };

    const service = new CAInitializerService(repo as never);
    await service.initializeCA();

    expect(repo.initialize).toHaveBeenCalledTimes(1);
    expect(repo.load).not.toHaveBeenCalled();
    expect(service.getCA()).toBe(initializedMaterial);
  });

  it('throws CAUninitializedError before startup completes', () => {
    const repo = {
      caExists: jest.fn(),
      load: jest.fn(),
      initialize: jest.fn(),
    };

    const service = new CAInitializerService(repo as never);
    expect(() => service.getCA()).toThrow(CAUninitializedError);
  });

  it('wraps repository failures in CAUninitializedError', async () => {
    const repo = {
      caExists: jest.fn().mockRejectedValue(new Error('fs error')),
      load: jest.fn(),
      initialize: jest.fn(),
    };

    const service = new CAInitializerService(repo as never);

    await expect(service.initializeCA()).rejects.toBeInstanceOf(
      CAUninitializedError,
    );
  });
});
