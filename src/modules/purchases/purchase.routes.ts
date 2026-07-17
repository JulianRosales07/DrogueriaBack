import { Router } from 'express';
import { PurchaseService } from './purchase.service';
import { requireAuth, authorize } from '@shared/middlewares/auth.middleware';
import { ApiError } from '@shared/errors/ApiError';

const purchaseRouter: Router = Router();
const purchaseService = new PurchaseService();

purchaseRouter.use(requireAuth, authorize('Administrador de Drogueria', 'Cajero'));

const getStoreId = (req: any): string => {
  const storeId = req.user?.storeId;
  if (!storeId) throw ApiError.forbidden('Usuario sin droguería asignada');
  return storeId;
};

purchaseRouter.get('/', async (req, res, next) => {
  try {
    const data = await purchaseService.list(getStoreId(req));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

purchaseRouter.post('/', async (req, res, next) => {
  try {
    const data = await purchaseService.create({
      ...req.body,
      actorUserId: req.user!.id,
      ipAddress: req.ip,
      storeId: getStoreId(req),
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

export { purchaseRouter };
