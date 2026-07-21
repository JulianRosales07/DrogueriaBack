import { Router } from 'express';
import { UsersService } from './users.service';
import { requireAuth, authorize } from '@shared/middlewares/auth.middleware';

const usersRouter: Router = Router();
const usersService = new UsersService();

const SUPER_ADMIN = 'Super Administrador';
const PHARMACY_ADMIN = 'Administrador de Drogueria';
const STORE_ADMIN = 'Administrador de Tienda';

// GET /api/users/store/staff — Listar el personal (cajeros, vendedores, etc.) de la propia tienda
// Usado por el Administrador de Drogueria o Administrador de Tienda para filtrar reportes por empleado.
usersRouter.get('/store/staff', requireAuth, authorize(PHARMACY_ADMIN, STORE_ADMIN), async (req, res, next) => {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.json({ success: true, data: [] });
    }
    const data = await usersService.listByStore(storeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/users — Listar todos los usuarios (solo Super Admin)
usersRouter.get('/', requireAuth, authorize(SUPER_ADMIN), async (_req, res, next) => {
  try {
    const data = await usersService.list();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/roles — Obtener roles disponibles (solo Super Admin)
usersRouter.get('/roles', requireAuth, authorize(SUPER_ADMIN), async (_req, res, next) => {
  try {
    const data = await usersService.getRoles();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id — Obtener usuario por ID (solo Super Admin)
usersRouter.get('/:id', requireAuth, authorize(SUPER_ADMIN), async (req, res, next) => {
  try {
    const data = await usersService.getById(req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/users — Crear usuario (solo Super Admin)
usersRouter.post('/', requireAuth, authorize(SUPER_ADMIN), async (req, res, next) => {
  try {
    const data = await usersService.create({
      ...req.body,
      actorUserId: req.user?.id,
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id — Actualizar usuario (solo Super Admin)
usersRouter.put('/:id', requireAuth, authorize(SUPER_ADMIN), async (req, res, next) => {
  try {
    const data = await usersService.update(req.params.id as string, {
      ...req.body,
      actorUserId: req.user?.id,
      ipAddress: req.ip,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id — Eliminar usuario (solo Super Admin)
usersRouter.delete('/:id', requireAuth, authorize(SUPER_ADMIN), async (req, res, next) => {
  try {
    await usersService.delete(req.params.id as string, req.user?.id, req.ip);
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

export { usersRouter };
