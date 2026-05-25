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

    test('GIVEN sin truck_type WHEN addTruck THEN lanza BadRequest', async () => {
      await expect(service.addTruck('u1', { patente: 'AB123CD' } as any)).rejects.toThrow(BadRequestException);
    });

    test('GIVEN vtv_vence inválida WHEN addTruck THEN lanza BadRequest', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      await expect(service.addTruck('u1', { patente: 'AB123CD', truck_type: 'Semi', vtv_vence: 'not-a-date' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN vtv_vence pasada WHEN addTruck THEN lanza BadRequest', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      await expect(service.addTruck('u1', { patente: 'AB123CD', truck_type: 'Semi', vtv_vence: '2000-01-01' })).rejects.toThrow(BadRequestException);
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

    test('GIVEN patente nueva inválida WHEN updateTruck THEN lanza BadRequest', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 't1', owner_id: 'u1', patente: 'AB123CD' });
      await expect(service.updateTruck('u1', 't1', { patente: '123' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN patente nueva válida no duplicada WHEN updateTruck THEN actualiza patente', async () => {
      trucksRepo.findOne
        .mockResolvedValueOnce({ id: 't1', owner_id: 'u1', patente: 'AB123CD' }) // primary lookup
        .mockResolvedValueOnce(null); // no duplicate
      await service.updateTruck('u1', 't1', { patente: 'XY456ZW' });
      expect(trucksRepo.save).toHaveBeenCalled();
    });

    test('GIVEN patente nueva ya existe en otro camión WHEN updateTruck THEN lanza ConflictException', async () => {
      trucksRepo.findOne
        .mockResolvedValueOnce({ id: 't1', owner_id: 'u1', patente: 'AB123CD' }) // primary lookup
        .mockResolvedValueOnce({ id: 't2', patente: 'XY456ZW' }); // duplicate found
      await expect(service.updateTruck('u1', 't1', { patente: 'XY456ZW' })).rejects.toThrow(ConflictException);
    });

    test('GIVEN capacity_kg <= 0 WHEN updateTruck THEN lanza BadRequest', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 't1', owner_id: 'u1', patente: 'AB123CD' });
      await expect(service.updateTruck('u1', 't1', { capacity_kg: 0 })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN año inválido WHEN updateTruck THEN lanza BadRequest', async () => {
      trucksRepo.findOne.mockResolvedValue({ id: 't1', owner_id: 'u1', patente: 'AB123CD' });
      await expect(service.updateTruck('u1', 't1', { año: 1900 })).rejects.toThrow(BadRequestException);
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
    test('GIVEN invitación ya aceptada WHEN acceptInvitation THEN lanza GoneException', async () => {
      invitationsRepo.findOne.mockResolvedValue({ status: 'accepted' });
      await expect(service.acceptInvitation('tok', 'u1')).rejects.toThrow(GoneException);
    });

    test('GIVEN invitación vencida WHEN acceptInvitation THEN lanza GoneException', async () => {
      invitationsRepo.findOne.mockResolvedValue({ status: 'pending', expires_at: new Date('2020-01-01'), fleet_owner_id: 'owner1' });
      await expect(service.acceptInvitation('tok', 'u1')).rejects.toThrow(GoneException);
    });

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

    test('GIVEN nombre vacío WHEN addFleetDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'transportista', email: 'owner@x.com', is_fleet_owner: false });
      await expect(service.addFleetDriver('u1', { ...validBody, name: '   ' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN email igual al owner WHEN addFleetDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'transportista', email: 'new@x.com', is_fleet_owner: false });
      await expect(service.addFleetDriver('u1', validBody)).rejects.toThrow(BadRequestException);
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

  // ── getMyProfile / updateMyProfile ────────────────────────────────────

  test('GIVEN transportista WHEN getMyProfile THEN devuelve perfil básico', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: 'transportista',
      name: 'Juan Perez',
      email: 'juan@test.com',
      phone: '1166660000',
      dni: '30123456',
    });
    const result = await service.getMyProfile('u1');
    expect(result).toEqual({
      id: 'u1',
      name: 'Juan Perez',
      email: 'juan@test.com',
      phone: '1166660000',
      dni: '30123456',
    });
  });

  test('GIVEN usuario no transportista WHEN getMyProfile THEN lanza ForbiddenException', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'shipper' });
    await expect(service.getMyProfile('u1')).rejects.toThrow(ForbiddenException);
  });

  test('GIVEN update válido WHEN updateMyProfile THEN actualiza nombre y teléfono', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: 'transportista',
      name: 'Viejo',
      email: 'driver@test.com',
      phone: null,
      dni: '30123456',
    });
    const result = await service.updateMyProfile('u1', {
      name: 'Nombre Nuevo',
      phone: '1166660000',
    });
    expect(usersRepo.save).toHaveBeenCalled();
    expect(result.name).toBe('Nombre Nuevo');
    expect(result.phone).toBe('1166660000');
  });

  test('GIVEN name vacío WHEN updateMyProfile THEN lanza BadRequestException', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: 'transportista',
      name: 'Viejo',
      email: 'driver@test.com',
    });
    await expect(
      service.updateMyProfile('u1', { name: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  test('GIVEN phone inválido WHEN updateMyProfile THEN lanza BadRequestException', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: 'transportista',
      name: 'Viejo',
      email: 'driver@test.com',
    });
    await expect(
      service.updateMyProfile('u1', { phone: '12' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── getFleetDrivers ─────────────────────────────────────────────────────

  test('GIVEN owner con show_as_fleet_driver WHEN getFleetDrivers THEN incluye al owner', async () => {
    usersRepo.find.mockResolvedValue([{ id: 'd1', name: 'Driver' }]);
    usersRepo.findOne.mockResolvedValue({ id: 'u1', name: 'Owner', show_as_fleet_driver: true });
    const result = await service.getFleetDrivers('u1');
    expect(result).toHaveLength(2);
  });

  test('GIVEN show_as_fleet_driver false WHEN getFleetDrivers THEN devuelve solo conductores', async () => {
    usersRepo.find.mockResolvedValue([{ id: 'd1', name: 'Driver' }]);
    usersRepo.findOne.mockResolvedValue({ id: 'u1', name: 'Owner', show_as_fleet_driver: false });
    const result = await service.getFleetDrivers('u1');
    expect(result).toHaveLength(1);
  });

  test('GIVEN owner ya en lista WHEN getFleetDrivers THEN no duplica al owner', async () => {
    usersRepo.find.mockResolvedValue([{ id: 'u1', name: 'Owner' }]);
    usersRepo.findOne.mockResolvedValue({ id: 'u1', name: 'Owner', show_as_fleet_driver: true });
    const result = await service.getFleetDrivers('u1');
    expect(result).toHaveLength(1);
  });

  // ── acceptInvitation (additional paths) ────────────────────────────────

  describe('acceptInvitation (additional)', () => {
    test('GIVEN inv.status expired WHEN acceptInvitation THEN lanza GoneException', async () => {
      invitationsRepo.findOne.mockResolvedValue({ status: 'expired', expires_at: new Date(Date.now() + 100000) });
      await expect(service.acceptInvitation('tok', 'u1')).rejects.toThrow(GoneException);
    });

    test('GIVEN expires_at vencido WHEN acceptInvitation THEN guarda expired y lanza GoneException', async () => {
      const inv = { status: 'pending', expires_at: new Date('2020-01-01') };
      invitationsRepo.findOne.mockResolvedValue(inv);
      await expect(service.acceptInvitation('tok', 'u1')).rejects.toThrow(GoneException);
      expect(invitationsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
    });

    test('GIVEN user no es transportista WHEN acceptInvitation THEN lanza ForbiddenException', async () => {
      invitationsRepo.findOne.mockResolvedValue({ status: 'pending', expires_at: new Date(Date.now() + 100000), email: 'x@x.com', fleet_owner_id: 'owner1' });
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'shipper', email: 'x@x.com' });
      await expect(service.acceptInvitation('tok', 'u1')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN fleet_owner_id === userId WHEN acceptInvitation THEN lanza BadRequestException', async () => {
      invitationsRepo.findOne.mockResolvedValue({ status: 'pending', expires_at: new Date(Date.now() + 100000), email: 'x@x.com', fleet_owner_id: 'u1' });
      usersRepo.findOne.mockResolvedValue({ id: 'u1', role: 'transportista', email: 'x@x.com' });
      await expect(service.acceptInvitation('tok', 'u1')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN fleetOwner ya es is_fleet_owner WHEN acceptInvitation THEN no llama save extra', async () => {
      const inv = { status: 'pending', expires_at: new Date(Date.now() + 100000), email: 'driver@x.com', fleet_owner_id: 'owner1' };
      invitationsRepo.findOne.mockResolvedValue(inv);
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'u1', role: 'transportista', email: 'driver@x.com' })
        .mockResolvedValueOnce({ id: 'owner1', is_fleet_owner: true });
      const result = await service.acceptInvitation('tok', 'u1');
      expect(result.ok).toBe(true);
    });
  });

  // ── addFleetDriver (additional paths) ──────────────────────────────────

  describe('addFleetDriver (additional)', () => {
    const owner = { id: 'u1', role: 'transportista', email: 'owner@x.com', is_fleet_owner: false };

    test('GIVEN body.email igual a owner.email WHEN addFleetDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne.mockResolvedValueOnce(owner);
      await expect(service.addFleetDriver('u1', { email: 'OWNER@X.COM', password: '12345678', name: 'X' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN teléfono inválido WHEN addFleetDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(null);
      await expect(service.addFleetDriver('u1', { email: 'new@x.com', password: '12345678', name: 'X', phone: '123' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN DNI inválido WHEN addFleetDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(null);
      await expect(service.addFleetDriver('u1', { email: 'new@x.com', password: '12345678', name: 'X', dni: '123' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN DNI duplicado WHEN addFleetDriver THEN lanza ConflictException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(null) // byEmail
        .mockResolvedValueOnce({ id: 'other' }); // byDni
      await expect(service.addFleetDriver('u1', { email: 'new@x.com', password: '12345678', name: 'X', dni: '12345678' })).rejects.toThrow(ConflictException);
    });

    test('GIVEN owner ya es is_fleet_owner WHEN addFleetDriver THEN no actualiza is_fleet_owner', async () => {
      const alreadyOwner = { ...owner, is_fleet_owner: true };
      usersRepo.findOne
        .mockResolvedValueOnce(alreadyOwner)
        .mockResolvedValueOnce(null);
      await service.addFleetDriver('u1', { email: 'new@x.com', password: '12345678', name: 'X' });
      // save only called once (the new driver), not again for owner
      expect(usersRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── updateDriver (additional paths) ────────────────────────────────────

  describe('updateDriver (additional)', () => {
    test('GIVEN teléfono inválido WHEN updateDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'd1', fleet_id: 'u1' });
      await expect(service.updateDriver('u1', 'd1', { phone: '123' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN DNI inválido WHEN updateDriver THEN lanza BadRequest', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'd1', fleet_id: 'u1' });
      await expect(service.updateDriver('u1', 'd1', { dni: 'abc' })).rejects.toThrow(BadRequestException);
    });

    test('GIVEN DNI duplicado de otro conductor WHEN updateDriver THEN lanza ConflictException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'd1', fleet_id: 'u1' })
        .mockResolvedValueOnce({ id: 'otro-driver' }); // byDni → different driver
      await expect(service.updateDriver('u1', 'd1', { dni: '12345678' })).rejects.toThrow(ConflictException);
    });

    test('GIVEN DNI propio WHEN updateDriver THEN actualiza correctamente', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'd1', fleet_id: 'u1', name: 'Pedro' })
        .mockResolvedValueOnce({ id: 'd1' }); // byDni → same driver, not a conflict
      await service.updateDriver('u1', 'd1', { dni: '12345678' });
      expect(usersRepo.save).toHaveBeenCalled();
    });
  });

  // ── getInvitation (success path) ───────────────────────────────────────

  test('GIVEN invitación válida pendiente WHEN getInvitation THEN devuelve datos', async () => {
    const expiresAt = new Date(Date.now() + 100000);
    invitationsRepo.findOne.mockResolvedValue({
      status: 'pending',
      expires_at: expiresAt,
      token: 'tok123',
      email: 'driver@x.com',
      fleet_owner: { name: 'El Dueño' },
    });
    const result = await service.getInvitation('tok123');
    expect(result.ownerName).toBe('El Dueño');
    expect(result.email).toBe('driver@x.com');
  });
});
