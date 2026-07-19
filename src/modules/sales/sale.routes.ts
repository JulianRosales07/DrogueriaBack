import { Router } from 'express';
import { SaleService } from './sale.service';
import { requireAuth, authorize } from '@shared/middlewares/auth.middleware';
import { ApiError } from '@shared/errors/ApiError';

const saleRouter: Router = Router();
const saleService = new SaleService();

saleRouter.use(requireAuth, authorize('Administrador de Drogueria', 'Cajero'));

const getStoreId = (req: any): string => {
  const storeId = req.user?.storeId;
  if (!storeId) throw ApiError.forbidden('Usuario sin droguería asignada');
  return storeId;
};

saleRouter.get('/', async (req, res, next) => {
  try {
    // El Cajero solo puede ver sus propias ventas. El Administrador puede
    // filtrar por cualquier usuario de su droguería con ?userId=... (o ver todas si se omite).
    const isCashier = req.user?.role === 'Cajero';
    const userId = isCashier ? req.user!.id : (req.query.userId as string | undefined);

    const data = await saleService.list(getStoreId(req), userId);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

saleRouter.post('/', async (req, res, next) => {
  try {
    const data = await saleService.create({
      ...req.body,
      actorUserId: req.user!.id,
      ipAddress: req.ip,
      storeId: getStoreId(req),
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

export { saleRouter };
