jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$mockedhash'),
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { FleetService } from './fleet.service';

describe('FleetService', () => {
  let service: FleetService;
  let trucksRepo: Record<string, jest.Mock>;
  let usersRepo: Record<string, jest.Mock>;
  let invitationsRepo: Record<string, jest.Mock>;
  let mailService: Record<string, jest.Mock>;

  beforeEach(() => {
    trucksRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 't1', ...d })),
      remove: jest.fn().mockResolvedValue({}),
    };
    usersRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 'u-new', ...d })),
      remove: jest.fn().mockResolvedValue({}),
    };
    invitationsRepo = {
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve(d)),
    };
    mailService = {
      sendInvitacionFlota: jest.fn().mockResolvedValue({}),
    };

    service = new FleetService(
      trucksRepo as any,
      usersRepo as any,
      invitationsRepo as any,
      mailService as any,
    );
  });

  // ── getMyTrucks ─────────────────────────────────────────────────────────

  test('GIVEN userId WHEN getMyTrucks THEN busca por owner_id', async () => {
    await service.getMyTrucks('u1');
    expect(trucksRepo.find).toHaveBeenCalledWith({ where: { owner_id: 'u1' } });
  });

  // ── addTruck ────────────────────────────────────────────────────────────

  describe('addTruck', () => {
    test('GIVEN sin patente WHEN addTruck THEN lanza BadRequest', async () => {
      await expect(service.addTruck('u1', { patente: '', truck_type: 'Semirremolque' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN patente inválida WHEN addTruck THEN lanza BadRequest', async () => {
      await expect(service.addTruck('u1', { patente: '123', truck_type: 'Semirremolque' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN patente duplicada WHEN addTruck THEN lanza ConflictException', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.addTruck('u1', { patente: 'AB123CD', truck_type: 'Semirremolque' })).rejects.toThrow(ConflictException);
    });

    test('GIVEN capacidad negativa WHEN addTruck THEN lanza BadRequest', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      await expect(service.addTruck('u1', { patente: 'AB123CD', truck_type: 'Semi', capacity_kg: -1 })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN año inválido WHEN addTruck THEN lanza BadRequest', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      await expect(service.addTruck('u1', { patente: 'AB123CD', truck_type: 'Semi', año: 1900 })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN datos válidos WHEN addTruck THEN crea camión', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      const result = await service.addTruck('u1', { patente: 'AB123CD', truck_type: 'Semi' });
      expect(trucksRepo.save).toHaveBeenCalled();
      expect(result.owner_id).toBe('u1');
    });
  });

  // ── updateTruck ─────────────────────────────────────────────────────────

  describe('updateTruck', () => {
    test('GIVEN camión no existe WHEN updateTruck THEN lanza NotFoundException', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      await expect(service.updateTruck('u1', 't1', {})).rejects.toThrow(NotFoundException);
    });

    test('GIVEN no es owner WHEN updateTruck THEN lanza ForbiddenException', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 't1', owner_id: 'otro' });
      await expect(service.updateTruck('u1', 't1', {})).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN datos válidos WHEN updateTruck THEN actualiza', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 't1', owner_id: 'u1', patente: 'AB123CD' });
      await service.updateTruck('u1', 't1', { truck_type: 'Chasis' });
      expect(trucksRepo.save).toHaveBeenCalled();
    });
  });

  // ── deleteTruck ─────────────────────────────────────────────────────────

  describe('deleteTruck', () => {
    test('GIVEN camión propio WHEN deleteTruck THEN elimina', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 't1', owner_id: 'u1' });
      const result = await service.deleteTruck('u1', 't1');
      expect(result.ok).toBe(true);
      expect(trucksRepo.remove).toHaveBeenCalled();
    });

    test('GIVEN no es owner WHEN deleteTruck THEN lanza Forbidden', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 't1', owner_id: 'otro' });
      await expect(service.deleteTruck('u1', 't1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── inviteDriver ────────────────────────────────────────────────────────

  describe('inviteDriver', () => {
    test('GIVEN owner no es transportista WHEN inviteDriver THEN lanza Forbidden', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'shipper' });
      await expect(service.inviteDriver('u1', 'driver@x.com')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN invitación pendiente vigente WHEN inviteDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'transportista', name: 'Juan' });
      invitationsRepo.findOne.mockResolvedValue({ expires_at: new Date(Date.now() + 100000), status: 'pending' });
      await expect(service.inviteDriver('u1', 'driver@x.com')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN datos válidos WHEN inviteDriver THEN envía mail', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'transportista', name: 'Juan' });
      invitationsRepo.findOne.mockResolvedValue(null);
      const result = await service.inviteDriver('u1', 'Driver@X.com');
      expect(mailService.sendInvitacionFlota).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  // ── getInvitation ───────────────────────────────────────────────────────

  describe('getInvitation', () => {
    test('GIVEN token no existe WHEN getInvitation THEN lanza NotFoundException', async () => {
      invitationsRepo.findOne.mockResolvedValue(null);
      await expect(service.getInvitation('abc')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN invitación ya aceptada WHEN getInvitation THEN lanza GoneException', async () => {
      invitationsRepo.findOne.mockResolvedValue({ status: 'accepted' });
      await expect(service.getInvitation('abc')).rejects.toThrow(GoneException);
    });

    test('GIVEN invitación vencida WHEN getInvitation THEN lanza GoneException', async () => {
      invitationsRepo.findOne.mockResolvedValue({ status: 'pending', expires_at: new Date('2020-01-01') });
      await expect(service.getInvitation('abc')).rejects.toThrow(GoneException);
    });
  });

  // ── acceptInvitation ────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    test('GIVEN usuario con email distinto WHEN acceptInvitation THEN lanza Forbidden', async () => {
      invitationsRepo.findOne.mockResolvedValue({
        status: 'pending',
        expires_at: new Date(Date.now() + 100000),
        email: 'otro@x.com',
        fleet_owner_id: 'owner1',
      });
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'transportista', email: 'diferente@x.com' });
      await expect(service.acceptInvitation('tok', 'u1')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN datos válidos WHEN acceptInvitation THEN une al driver a la flota', async () => {
      const inv = {
        status: 'pending',
        expires_at: new Date(Date.now() + 100000),
        email: 'driver@x.com',
        fleet_owner_id: 'owner1',
      };
      invitationsRepo.findOne.mockResolvedValue(inv);
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', role: 'transportista', email: 'driver@x.com' }) // user
        .mockResolvedValueOnce({ id: 'owner1', is_fleet_owner: false }); // fleet owner
      const result = await service.acceptInvitation('tok', 'u1');
      expect(result.ok).toBe(true);
    });
  });

  // ── addFleetDriver ──────────────────────────────────────────────────────

  describe('addFleetDriver', () => {
    const validBody = { email: 'new@x.com', password: '12345678', name: 'Pedro' };

    test('GIVEN owner no es transportista WHEN addFleetDriver THEN lanza Forbidden', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'shipper' });
      await expect(service.addFleetDriver('u1', validBody)).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN email duplicado WHEN addFleetDriver THEN lanza Conflict', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', role: 'transportista', email: 'owner@x.com', is_fleet_owner: false })
        .mockResolvedValueOnce({ id: 'exists' }); // byEmail
      await expect(service.addFleetDriver('u1', validBody)).rejects.toThrow(ConflictException);
    });

    test('GIVEN password corta WHEN addFleetDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', role: 'transportista', email: 'owner@x.com', is_fleet_owner: false })
        .mockResolvedValueOnce(null); // no email conflict
      await expect(service.addFleetDriver('u1', { ...validBody, password: '123' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN datos válidos WHEN addFleetDriver THEN crea conductor', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', role: 'transportista', email: 'owner@x.com', is_fleet_owner: false })
        .mockResolvedValueOnce(null); // no email conflict
      const result = await service.addFleetDriver('u1', validBody);
      expect(usersRepo.save).toHaveBeenCalled();
      expect(result.fleet_id).toBe('u1');
    });
  });

  // ── updateDriver ────────────────────────────────────────────────────────

  describe('updateDriver', () => {
    test('GIVEN conductor no existe WHEN updateDriver THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.updateDriver('u1', 'd1', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    test('GIVEN no es de la flota WHEN updateDriver THEN lanza Forbidden', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'd1', fleet_id: 'otro' });
      await expect(service.updateDriver('u1', 'd1', { name: 'X' })).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN datos válidos WHEN updateDriver THEN actualiza', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'd1', fleet_id: 'u1', name: 'Old' });
      await service.updateDriver('u1', 'd1', { name: 'New' });
      expect(usersRepo.save).toHaveBeenCalled();
    });
  });

  // ── deleteDriver ────────────────────────────────────────────────────────

  describe('deleteDriver', () => {
    test('GIVEN conductor de la flota WHEN deleteDriver THEN elimina', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'd1', fleet_id: 'u1' });
      const result = await service.deleteDriver('u1', 'd1');
      expect(result.ok).toBe(true);
    });
  });

  // ── getOwnerSettings / updateOwnerSettings ──────────────────────────────

  test('GIVEN userId WHEN getOwnerSettings THEN devuelve show_as_fleet_driver', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 'u1', show_as_fleet_driver: false });
    const result = await service.getOwnerSettings('u1');
    expect(result.show_as_fleet_driver).toBe(false);
  });

  test('GIVEN usuario WHEN updateOwnerSettings THEN actualiza flag', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'transportista', show_as_fleet_driver: true });
    const result = await service.updateOwnerSettings('u1', { show_as_fleet_driver: false });
    expect(result.show_as_fleet_driver).toBe(false);
  });

  // ── getFleetDrivers ─────────────────────────────────────────────────────

  test('GIVEN owner con show_as_fleet_driver WHEN getFleetDrivers THEN incluye al owner', async () => {
    usersRepo.find.mockResolvedValue([{ id: 'd1', name: 'Driver' }]);
    usersRepo.findOne.mockResolvedValue({ id: 'u1', name: 'Owner', show_as_fleet_driver: true });
    const result = await service.getFleetDrivers('u1');
    expect(result).toHaveLength(2);
  });
});
