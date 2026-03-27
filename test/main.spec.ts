describe('main bootstrap', () => {
  it('creates app, enables hooks/pipes and listens on configured port', async () => {
    const enableShutdownHooks = jest.fn();
    const useGlobalPipes = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn().mockReturnValue({ PORT: 3456 });

    const create = jest.fn().mockResolvedValue({
      enableShutdownHooks,
      useGlobalPipes,
      listen,
      get,
    });

    jest.resetModules();
    jest.doMock('../src/app.module', () => ({
      AppModule: class AppModuleMock {},
    }));
    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create },
    }));

    jest.requireActual<typeof import('../src/main')>('../src/main');

    await new Promise((resolve) => setImmediate(resolve));

    expect(create).toHaveBeenCalledTimes(1);
    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('CONFIG');
    expect(listen).toHaveBeenCalledWith(3456);
  });
});
