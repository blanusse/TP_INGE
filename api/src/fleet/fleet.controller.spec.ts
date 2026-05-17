import { Test, TestingModule } from '@nestjs/testing';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';

describe('FleetController', () => {
  let controller: FleetController;
  let service: Record<string, jest.Mock>;

  const REQ = { user: { id: 'u1', role: 'transportista', email: 'test@test.com' } };

  beforeEach(async () => {
    service = {
      getMyTrucks: jest.fn().mockResolvedValue([]),
      addTruck: jest.fn().mockResolvedValue({ id: 't1' }),
      updateTruck: jest.fn().mockResolvedValue({ id: 't1' }),
      deleteTruck: jest.fn().mockResolvedValue({ ok: true }),
      getFleetDrivers: jest.fn().mockResolvedValue([]),
      addFleetDriver: jest.fn().mockResolvedValue({ id: 'd1' }),
      updateDriver: jest.fn().mockResolvedValue({ id: 'd1' }),
      deleteDriver: jest.fn().mockResolvedValue({ ok: true }),
      inviteDriver: jest.fn().mockResolvedValue({ ok: true }),
      getInvitation: jest.fn().mockResolvedValue({}),
      acceptInvitation: jest.fn().mockResolvedValue({ ok: true }),
      getOwnerSettings: jest.fn().mockResolvedValue({ show_as_fleet_driver: true }),
      updateOwnerSettings: jest.fn().mockResolvedValue({ show_as_fleet_driver: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FleetController],
      providers: [{ provide: FleetService, useValue: service }],
    }).compile();

    controller = module.get<FleetController>(FleetController);
  });

  test('GIVEN usuario WHEN getMyTrucks THEN delega con userId', async () => {
    await controller.getMyTrucks(REQ);
    expect(service.getMyTrucks).toHaveBeenCalledWith('u1');
  });

  test('GIVEN body WHEN addTruck THEN delega con userId y body', async () => {
    const body = { patente: 'AB123CD', truck_type: 'Semi' };
    await controller.addTruck(REQ, body);
    expect(service.addTruck).toHaveBeenCalledWith('u1', body);
  });

  test('GIVEN id y body WHEN updateTruck THEN delega', async () => {
    await controller.updateTruck(REQ, 't1', { truck_type: 'Chasis' });
    expect(service.updateTruck).toHaveBeenCalledWith('u1', 't1', { truck_type: 'Chasis' });
  });

  test('GIVEN id WHEN deleteTruck THEN delega', async () => {
    await controller.deleteTruck(REQ, 't1');
    expect(service.deleteTruck).toHaveBeenCalledWith('u1', 't1');
  });

  test('GIVEN usuario WHEN getFleetDrivers THEN delega', async () => {
    await controller.getFleetDrivers(REQ);
    expect(service.getFleetDrivers).toHaveBeenCalledWith('u1');
  });

  test('GIVEN body WHEN addFleetDriver THEN delega', async () => {
    const body = { email: 'x@x.com', password: '12345678', name: 'Test' };
    await controller.addFleetDriver(REQ, body);
    expect(service.addFleetDriver).toHaveBeenCalledWith('u1', body);
  });

  test('GIVEN email WHEN inviteDriver THEN delega', async () => {
    await controller.inviteDriver(REQ, { email: 'x@x.com' });
    expect(service.inviteDriver).toHaveBeenCalledWith('u1', 'x@x.com');
  });

  test('GIVEN token WHEN getInvitation THEN delega', async () => {
    await controller.getInvitation('tok123');
    expect(service.getInvitation).toHaveBeenCalledWith('tok123');
  });

  test('GIVEN token y user WHEN acceptInvitation THEN delega', async () => {
    await controller.acceptInvitation('tok123', REQ);
    expect(service.acceptInvitation).toHaveBeenCalledWith('tok123', 'u1');
  });

  test('GIVEN usuario WHEN getSettings THEN delega', async () => {
    await controller.getSettings(REQ);
    expect(service.getOwnerSettings).toHaveBeenCalledWith('u1');
  });

  test('GIVEN body WHEN updateSettings THEN delega', async () => {
    await controller.updateSettings(REQ, { show_as_fleet_driver: false });
    expect(service.updateOwnerSettings).toHaveBeenCalledWith('u1', { show_as_fleet_driver: false });
  });
});
