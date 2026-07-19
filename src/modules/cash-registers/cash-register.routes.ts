import { Router } from 'express';
import { CashRegisterService } from './cash-register.service';
import { requireAuth, authorize } from '@shared/middlewares/auth.middleware';
import { ApiError } from '@shared/errors/ApiError';

const cashRegisterRouter: Router = Router();
const cashRegisterService = new CashRegisterService();

cashRegisterRouter.use(requireAuth, authorize('Administrador de Drogueria', 'Cajero'));

const getStoreId = (req: any): string => {
  const storeId = req.user?.storeId;
  if (!storeId) throw ApiError.forbidden('Usuario sin droguería asignada');
  return storeId;
};

cashRegisterRouter.get('/current', async (req, res, next) => {
  try {
    const data = await cashRegisterService.getCurrent(getStoreId(req));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

cashRegisterRouter.get('/history', async (req, res, next) => {
  try {
    const data = await cashRegisterService.history(getStoreId(req));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

cashRegisterRouter.post('/open', async (req, res, next) => {
  try {
    const data = await cashRegisterService.open({
      storeId: getStoreId(req),
      actorUserId: req.user!.id,
      ipAddress: req.ip,
      openingAmount: Number(req.body.openingAmount),
      note: req.body.note,
    });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

cashRegisterRouter.post('/close', async (req, res, next) => {
  try {
    const data = await cashRegisterService.close({
      storeId: getStoreId(req),
      actorUserId: req.user!.id,
      ipAddress: req.ip,
      closingAmount: Number(req.body.closingAmount),
      note: req.body.note,
    });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

export { cashRegisterRouter };
