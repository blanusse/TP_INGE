import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { StatsService } from './stats.service';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { Load } from '../entities/load.entity';
import { Offer } from '../entities/offer.entity';
import { Rating } from '../entities/rating.entity';
import { Truck } from '../entities/truck.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function mockRatingQb(repo: ReturnType<typeof makeRepo>, avg: string | null) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ avg }),
  };
  repo.createQueryBuilder.mockReturnValue(qb);
  return qb;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('StatsService', () => {
  let service: StatsService;
  let usersRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;
  let loadsRepo: ReturnType<typeof makeRepo>;
  let offersRepo: ReturnType<typeof makeRepo>;
  let ratingsRepo: ReturnType<typeof makeRepo>;
  let trucksRepo: ReturnType<typeof makeRepo>;

  const DRIVER_ID = 'driver-1';
  const SHIPPER_USER_ID = 'shipper-user-1';

  beforeEach(async () => {
    usersRepo = makeRepo();
    shippersRepo = makeRepo();
    loadsRepo = makeRepo();
    offersRepo = makeRepo();
    ratingsRepo = makeRepo();
    trucksRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
        { provide: getRepositoryToken(Offer), useValue: offersRepo },
        { provide: getRepositoryToken(Rating), useValue: ratingsRepo },
        { provide: getRepositoryToken(Truck), useValue: trucksRepo },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getDriverStats ────────────────────────────────────────────────────────

  describe('getDriverStats', () => {
    test('GIVEN usuario no es transportista WHEN getDriverStats THEN lanza ForbiddenException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: DRIVER_ID, role: 'shipper' });

      await expect(service.getDriverStats(DRIVER_ID)).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN usuario inexistente WHEN getDriverStats THEN lanza ForbiddenException', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.getDriverStats('bad')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN transportista sin viajes WHEN getDriverStats THEN devuelve stats vacías', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: DRIVER_ID, role: 'transportista', created_at: new Date(), phone: null, dni: null,
      });
      offersRepo.find.mockResolvedValue([]);
      mockRatingQb(ratingsRepo, null);

      const result = await service.getDriverStats(DRIVER_ID);

      expect(result.viajesCompletados).toBe(0);
      expect(result.totalIngresos6m).toBe(0);
      expect(result.calificacionPromedio).toBeNull();
    });

    test('GIVEN transportista con distintas rutas WHEN getDriverStats THEN ordena rutasFrecuentes por cantidad', async () => {
      const now = new Date();
      usersRepo.findOne.mockResolvedValue({
        id: DRIVER_ID, role: 'transportista', created_at: now, phone: '111', dni: '30123456',
      });
      offersRepo.find.mockResolvedValue([
        { load_id: 'l1', driver_id: DRIVER_ID, price: 10000 },
        { load_id: 'l2', driver_id: DRIVER_ID, price: 20000 },
        { load_id: 'l3', driver_id: DRIVER_ID, price: 30000 },
      ]);
      loadsRepo.find.mockResolvedValue([
        { id: 'l1', status: 'delivered', cargo_type: 'Granos', pickup_city: 'BA', dropoff_city: 'CBA', created_at: now },
        { id: 'l2', status: 'delivered', cargo_type: 'Granos', pickup_city: 'BA', dropoff_city: 'CBA', created_at: now },
        { id: 'l3', status: 'delivered', cargo_type: 'Frutas', pickup_city: 'MZA', dropoff_city: 'BA', created_at: now },
      ]);
      mockRatingQb(ratingsRepo, null);

      const result = await service.getDriverStats(DRIVER_ID);

      expect(result.rutasFrecuentes[0].ruta).toBe('BA → CBA');
      expect(result.rutasFrecuentes[0].viajes).toBe(2);
    });

    test('GIVEN transportista con viajes entregados WHEN getDriverStats THEN calcula stats correctas', async () => {
      const now = new Date();
      usersRepo.findOne.mockResolvedValue({
        id: DRIVER_ID, role: 'transportista', created_at: now, phone: '111', dni: '30123456',
      });
      offersRepo.find.mockResolvedValue([
        { load_id: 'l1', driver_id: DRIVER_ID, price: 50000 },
        { load_id: 'l2', driver_id: DRIVER_ID, price: 70000 },
      ]);
      loadsRepo.find.mockResolvedValue([
        { id: 'l1', status: 'delivered', cargo_type: 'Granos', pickup_city: 'BA', dropoff_city: 'CBA', created_at: now },
        { id: 'l2', status: 'delivered', cargo_type: 'Granos', pickup_city: 'BA', dropoff_city: 'CBA', created_at: now },
      ]);
      mockRatingQb(ratingsRepo, '4.5');

      const result = await service.getDriverStats(DRIVER_ID);

      expect(result.viajesCompletados).toBe(2);
      expect(result.calificacionPromedio).toBe('4.5');
      expect(result.tiposCarga).toEqual([
        expect.objectContaining({ tipo: 'Granos', cantidad: 2 }),
      ]);
      expect(result.rutasFrecuentes).toEqual([{ ruta: 'BA → CBA', viajes: 2 }]);
    });
  });

  // ── getDriverCobros ───────────────────────────────────────────────────────

  describe('getDriverCobros', () => {
    test('GIVEN usuario no transportista WHEN getDriverCobros THEN lanza ForbiddenException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: DRIVER_ID, role: 'shipper' });

      await expect(service.getDriverCobros(DRIVER_ID)).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN transportista con cobros WHEN getDriverCobros THEN devuelve lista filtrada', async () => {
      usersRepo.findOne.mockResolvedValue({ id: DRIVER_ID, role: 'transportista' });
      offersRepo.find.mockResolvedValue([
        {
          id: 'o1',
          driver_id: DRIVER_ID,
          price: 50000,
          created_at: new Date(),
          load: {
            status: 'delivered',
            pickup_city: 'BA',
            dropoff_city: 'CBA',
            shipper: { razon_social: 'Empresa SA', user: { name: 'Juan' } },
          },
        },
      ]);

      const result = await service.getDriverCobros(DRIVER_ID);

      expect(result.cobros).toHaveLength(1);
      expect(result.cobros[0].monto).toBe(50000);
      expect(result.cobros[0].dador).toBe('Empresa SA');
    });

    test('GIVEN filtro de fechas WHEN getDriverCobros THEN filtra correctamente', async () => {
      usersRepo.findOne.mockResolvedValue({ id: DRIVER_ID, role: 'transportista' });
      offersRepo.find.mockResolvedValue([
        {
          id: 'o1',
          driver_id: DRIVER_ID,
          price: 50000,
          created_at: new Date('2025-06-15'),
          load: { status: 'delivered', pickup_city: 'BA', dropoff_city: 'CBA' },
        },
      ]);

      const result = await service.getDriverCobros(DRIVER_ID, '2025-07-01', '2025-07-31');

      expect(result.cobros).toHaveLength(0); // offer is from June, filter is July
    });
  });

  // ── getFleetStats ─────────────────────────────────────────────────────────

  describe('getFleetStats', () => {
    test('GIVEN usuario no transportista WHEN getFleetStats THEN lanza ForbiddenException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: DRIVER_ID, role: 'shipper' });

      await expect(service.getFleetStats(DRIVER_ID)).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN driverId que no pertenece a la flota WHEN getFleetStats THEN lanza ForbiddenException', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: DRIVER_ID, role: 'transportista' });
      usersRepo.find.mockResolvedValue([]); // no sub-drivers

      await expect(
        service.getFleetStats(DRIVER_ID, undefined, undefined, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN flota sin viajes WHEN getFleetStats THEN devuelve stats en 0', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: DRIVER_ID, role: 'transportista' });
      usersRepo.find
        .mockResolvedValueOnce([])    // subDrivers
        .mockResolvedValueOnce([{ id: DRIVER_ID, name: 'Owner' }]); // driverUsers
      offersRepo.find.mockResolvedValue([]);
      mockRatingQb(ratingsRepo, null);
      trucksRepo.find.mockResolvedValue([]);

      const result = await service.getFleetStats(DRIVER_ID);

      expect(result.totalViajes).toBe(0);
      expect(result.totalIngresos).toBe(0);
      expect(result.totalConductores).toBe(0);
      expect(result.totalCamiones).toBe(0);
    });

    test('GIVEN flota con viajes entregados WHEN getFleetStats THEN calcula totales y mejorConductor', async () => {
      const SUB_ID = 'sub-1';
      usersRepo.findOne.mockResolvedValueOnce({ id: DRIVER_ID, role: 'transportista' });
      usersRepo.find
        .mockResolvedValueOnce([{ id: SUB_ID }]) // subDrivers
        .mockResolvedValueOnce([
          { id: DRIVER_ID, name: 'Owner' },
          { id: SUB_ID, name: 'Sub Driver' },
        ]); // driverUsers
      offersRepo.find.mockResolvedValue([
        { id: 'o1', driver_id: DRIVER_ID, truck_id: 'tk1', price: 30000, created_at: new Date(), load: { status: 'delivered' } },
        { id: 'o2', driver_id: SUB_ID, truck_id: 'tk1', price: 50000, created_at: new Date(), load: { status: 'delivered' } },
        { id: 'o3', driver_id: DRIVER_ID, truck_id: 'tk2', price: 20000, created_at: new Date(), load: { status: 'pending' } },
      ]);
      mockRatingQb(ratingsRepo, '4.2');
      trucksRepo.find.mockResolvedValue([{ id: 'tk1' }, { id: 'tk2' }]);

      const result = await service.getFleetStats(DRIVER_ID);

      expect(result.totalViajes).toBe(2);
      expect(result.totalIngresos).toBe(80000);
      expect(result.calificacionPromedio).toBe('4.2');
      expect(result.mejorConductor).not.toBeNull();
      expect(result.perConductor).toHaveLength(2);
    });

    test('GIVEN filtro de fechas WHEN getFleetStats THEN excluye ofertas fuera del rango', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: DRIVER_ID, role: 'transportista' });
      usersRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: DRIVER_ID, name: 'Owner' }]);
      offersRepo.find.mockResolvedValue([
        { id: 'o-in', driver_id: DRIVER_ID, truck_id: null, price: 40000, created_at: new Date('2025-07-15'), load: { status: 'delivered' } },
        { id: 'o-out', driver_id: DRIVER_ID, truck_id: null, price: 99000, created_at: new Date('2025-06-01'), load: { status: 'delivered' } },
      ]);
      mockRatingQb(ratingsRepo, null);
      trucksRepo.find.mockResolvedValue([]);

      const result = await service.getFleetStats(DRIVER_ID, '2025-07-01', '2025-07-31');

      expect(result.totalViajes).toBe(1);
      expect(result.totalIngresos).toBe(40000);
    });

    test('GIVEN driverId específico WHEN getFleetStats THEN filtra solo para ese conductor', async () => {
      const SUB_ID = 'sub-2';
      usersRepo.findOne.mockResolvedValueOnce({ id: DRIVER_ID, role: 'transportista' });
      usersRepo.find
        .mockResolvedValueOnce([{ id: SUB_ID }])
        .mockResolvedValueOnce([{ id: DRIVER_ID, name: 'Owner' }, { id: SUB_ID, name: 'Sub 2' }]);
      offersRepo.find.mockResolvedValue([
        { id: 'o-sub', driver_id: SUB_ID, truck_id: null, price: 60000, created_at: new Date(), load: { status: 'delivered' } },
      ]);
      mockRatingQb(ratingsRepo, '3.8');
      trucksRepo.find.mockResolvedValue([]);

      const result = await service.getFleetStats(DRIVER_ID, undefined, undefined, SUB_ID);

      expect(result.totalViajes).toBe(1);
      expect(result.perConductor).toHaveLength(1);
      expect(result.perConductor[0].id).toBe(SUB_ID);
    });
  });

  // ── getShipperStats ───────────────────────────────────────────────────────

  describe('getShipperStats', () => {
    test('GIVEN usuario sin perfil shipper WHEN getShipperStats THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(null);

      await expect(service.getShipperStats(SHIPPER_USER_ID)).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN shipper con cargas WHEN getShipperStats THEN devuelve estadísticas', async () => {
      shippersRepo.findOne.mockResolvedValue({
        id: 'shipper-1', user_id: SHIPPER_USER_ID, tipo: 'empresa',
        razon_social: 'Mi Empresa', cuit: '20301234563', cuil: null, address: 'Calle 1',
      });
      const loads = [
        ...Array.from({ length: 8 }, (_, i) => ({ id: `l${i}`, status: 'available', created_at: new Date() })),
        { id: 'l8', status: 'in_transit', created_at: new Date() },
        { id: 'l9', status: 'in_transit', created_at: new Date() },
      ];
      loadsRepo.find.mockResolvedValue(loads);
      offersRepo.find.mockResolvedValue([]);
      mockRatingQb(ratingsRepo, '4.2');
      usersRepo.findOne.mockResolvedValue({
        id: SHIPPER_USER_ID, created_at: new Date(), phone: '111', dni: '30123456',
      });

      const result = await service.getShipperStats(SHIPPER_USER_ID);

      expect(result.totalCargas).toBe(10);
      expect(result.enTransito).toBe(2);
      expect(result.calificacionPromedio).toBe('4.2');
      expect(result.tipo).toBe('empresa');
      expect(result.razonSocial).toBe('Mi Empresa');
    });
  });
});
