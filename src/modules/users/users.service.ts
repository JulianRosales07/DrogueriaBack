import bcrypt from 'bcryptjs';
import { UsersRepository } from './users.repository';
import { ApiError } from '@shared/errors/ApiError';
import { env } from '@config/env';
import { createAuditLog } from '@shared/utils/audit';

type CreateUserInput = {
  email: string;
  username: string;
  fullName: string;
  password: string;
  roleId: string;
  storeId?: string | null;
  status?: string;
  actorUserId?: string;
  ipAddress?: string;
};

type UpdateUserInput = {
  email?: string;
  username?: string;
  fullName?: string;
  password?: string;
  roleId?: string;
  storeId?: string | null;
  status?: string;
  actorUserId?: string;
  ipAddress?: string;
};

export class UsersService {
  private usersRepo = new UsersRepository();

  async list() {
    return this.usersRepo.findAll();
  }

  /** Lista el personal (usuarios) de una droguería específica. */
  async listByStore(storeId: string) {
    return this.usersRepo.findByStoreId(storeId);
  }

  async getRoles() {
    return this.usersRepo.getRoles();
  }

  async getById(id: string) {
    const user = await this.usersRepo.findById(id);
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    return user;
  }

  async create(input: CreateUserInput) {
    const byEmail = await this.usersRepo.findByEmail(input.email);
    if (byEmail) throw ApiError.badRequest('El correo electrónico ya está en uso');

    const byUsername = await this.usersRepo.findByUsername(input.username);
    if (byUsername) throw ApiError.badRequest('El nombre de usuario ya está en uso');

    const passwordHash = await bcrypt.hash(input.password, env.security.bcryptRounds);

    const user = await this.usersRepo.create({
      email: input.email,
      username: input.username,
      fullName: input.fullName,
      passwordHash,
      roleId: input.roleId,
      storeId: input.storeId ?? null,
      status: input.status ?? 'ACTIVE',
    });

    await createAuditLog({
      entityType: 'user',
      entityId: user.id,
      action: 'user.created',
      description: `Usuario creado: ${user.email}`,
      userId: input.actorUserId,
      ipAddress: input.ipAddress,
    });

    return user;
  }

  async update(id: string, input: UpdateUserInput) {
    const existing = await this.usersRepo.findById(id);
    if (!existing) throw ApiError.notFound('Usuario no encontrado');

    if (input.email && input.email !== existing.email) {
      const byEmail = await this.usersRepo.findByEmail(input.email);
      if (byEmail) throw ApiError.badRequest('El correo electrónico ya está en uso');
    }

    if (input.username && input.username !== existing.username) {
      const byUsername = await this.usersRepo.findByUsername(input.username);
      if (byUsername) throw ApiError.badRequest('El nombre de usuario ya está en uso');
    }

    let passwordHash: string | undefined;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, env.security.bcryptRounds);
    }

    const user = await this.usersRepo.update(id, {
      email: input.email,
      username: input.username,
      fullName: input.fullName,
      passwordHash,
      roleId: input.roleId,
      storeId: input.storeId,
      status: input.status,
    });

    await createAuditLog({
      entityType: 'user',
      entityId: user.id,
      action: 'user.updated',
      description: `Usuario actualizado: ${user.email}`,
      userId: input.actorUserId,
      ipAddress: input.ipAddress,
    });

    return user;
  }

  async delete(id: string, actorUserId?: string, ipAddress?: string) {
    const existing = await this.usersRepo.findById(id);
    if (!existing) throw ApiError.notFound('Usuario no encontrado');

    if (actorUserId && actorUserId === id) {
      throw ApiError.badRequest('No puedes eliminar tu propio usuario');
    }

    await this.usersRepo.delete(id);

    await createAuditLog({
      entityType: 'user',
      entityId: id,
      action: 'user.deleted',
      description: `Usuario eliminado: ${existing.email}`,
      userId: actorUserId,
      ipAddress,
    });
  }
}
