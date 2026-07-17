import { Router } from 'express';
import { DashboardService } from './dashboard.service';
import { requireAuth, authorize } from '@shared/middlewares/auth.middleware';
import { ApiError } from '@shared/errors/ApiError';

const dashboardRouter: Router = Router();
const dashboardService = new DashboardService();

dashboardRouter.use(requireAuth, authorize('Administrador de Drogueria', 'Cajero'));

const getStoreId = (req: any): string => {
  const storeId = req.user?.storeId;
  if (!storeId) throw ApiError.forbidden('Usuario sin droguería asignada');
  return storeId;
};

dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const data = await dashboardService.summary(getStoreId(req));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

export { dashboardRouter };
