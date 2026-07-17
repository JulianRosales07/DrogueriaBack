import { ProductRepository, CreateProductInput, UpdateProductInput } from './product.repository';
import { ApiError } from '@shared/errors/ApiError';
import { createAuditLog } from '@shared/utils/audit';

type ProductInputWithAudit = CreateProductInput & {
  actorUserId?: string;
  ipAddress?: string;
  storeId: string;
};

type UpdateProductInputWithAudit = UpdateProductInput & {
  actorUserId?: string;
  ipAddress?: string;
  storeId: string;
};

export class ProductService {
  private productRepo = new ProductRepository();

  async list(storeId: string) {
    return this.productRepo.findAll(storeId);
  }

  async lowStock(storeId: string) {
    return this.productRepo.findLowStock(storeId);
  }

  async create(input: ProductInputWithAudit) {
    const existing = await this.productRepo.findBySku(input.sku, input.storeId);
    if (existing) {
      throw ApiError.badRequest('El SKU ya está en uso');
    }

    const product = await this.productRepo.create(input, input.storeId);

    await createAuditLog({
      entityType: 'product',
      entityId: product.id,
      action: 'product.created',
      description: 'Producto creado',
      userId: input.actorUserId,
      ipAddress: input.ipAddress,
    });

    return product;
  }

  async update(productId: string, input: UpdateProductInputWithAudit) {
    const existing = await this.productRepo.findById(productId, input.storeId);
    if (!existing) {
      throw ApiError.notFound('Producto no encontrado');
    }

    if (input.sku && input.sku !== existing.sku) {
      const skuExists = await this.productRepo.findBySku(input.sku, input.storeId);
      if (skuExists) {
        throw ApiError.badRequest('El SKU ya está en uso');
      }
    }

    const product = await this.productRepo.update(productId, input, input.storeId);

    await createAuditLog({
      entityType: 'product',
      entityId: product.id,
      action: 'product.updated',
      description: 'Producto actualizado',
      userId: input.actorUserId,
      ipAddress: input.ipAddress,
    });

    return product;
  }

  async adjustStock(
    productId: string,
    newStock: number,
    options: { actorUserId?: string; ipAddress?: string; note?: string; storeId: string },
  ) {
    const existing = await this.productRepo.findById(productId, options.storeId);
    if (!existing) {
      throw ApiError.notFound('Producto no encontrado');
    }

    if (newStock < 0) {
      throw ApiError.badRequest('El stock no puede ser negativo');
    }

    const product = await this.productRepo.setStock(productId, newStock, options.storeId, options.note);

    await createAuditLog({
      entityType: 'product',
      entityId: product.id,
      action: 'product.stock_adjusted',
      description: `Ajuste de stock a ${newStock} unidades`,
      userId: options.actorUserId,
      ipAddress: options.ipAddress,
    });

    return product;
  }

  async remove(productId: string, options: { actorUserId?: string; ipAddress?: string; storeId: string }) {
    const existing = await this.productRepo.findById(productId, options.storeId);
    if (!existing) {
      throw ApiError.notFound('Producto no encontrado');
    }

    try {
      await this.productRepo.delete(productId, options.storeId);
    } catch (error: any) {
      if (error.code === 'HAS_HISTORY') {
        throw ApiError.badRequest(error.message);
      }
      throw error;
    }

    await createAuditLog({
      entityType: 'product',
      entityId: productId,
      action: 'product.deleted',
      description: 'Producto eliminado',
      userId: options.actorUserId,
      ipAddress: options.ipAddress,
    });
  }
}
