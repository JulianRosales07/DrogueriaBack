import { getSupabaseClient, throwIfError } from '@core/database/connection';
import { ApiError } from '@shared/errors/ApiError';
import { createAuditLog } from '@shared/utils/audit';

type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitCost: number;
  unitFactor?: number;
  unitLabel?: string;
  productUnitId?: string | null;
};

type PurchaseInput = {
  supplierId: string;
  invoiceNumber?: string;
  notes?: string;
  tax?: number;
  items: PurchaseItemInput[];
  actorUserId: string;
  ipAddress?: string;
  storeId: string;
};

export class PurchaseService {
  private get client() {
    return getSupabaseClient();
  }

  async list(storeId: string) {
    const { data, error } = await this.client
      .from('purchases')
      .select(
        `*, suppliers(business_name), users(full_name),
         purchase_items(id, product_id, quantity, unit_cost, line_total, unit_label, unit_factor, unit_quantity, products(name))`
      )
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    throwIfError(error);
    return data;
  }

  async create(input: PurchaseInput) {
    if (!input.items?.length) {
      throw ApiError.badRequest('La compra debe incluir al menos un ítem');
    }

    const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
      + (input.tax ?? 0);

    const { data: purchaseId, error } = await this.client.rpc('create_purchase', {
      p_supplier_id: input.supplierId,
      p_user_id: input.actorUserId,
      p_invoice_number: input.invoiceNumber || null,
      p_notes: input.notes || null,
      p_tax: input.tax ?? 0,
      p_store_id: input.storeId,
      p_items: input.items.map((item) => ({
        productId: item.productId,
        unitQuantity: item.quantity,
        unitCost: item.unitCost,
        unitFactor: item.unitFactor ?? 1,
        unitLabel: item.unitLabel ?? 'Unidad',
        productUnitId: item.productUnitId ?? null,
      })),
    });

    if (error) {
      throw ApiError.badRequest(error.message);
    }

    const { data: purchase, error: fetchError } = await this.client
      .from('purchases')
      .select(
        `*, suppliers(business_name),
         purchase_items(id, product_id, quantity, unit_cost, line_total, unit_label, unit_factor, unit_quantity, products(name))`
      )
      .eq('id', purchaseId as string)
      .single();
    throwIfError(fetchError);

    await createAuditLog({
      entityType: 'purchase',
      entityId: purchaseId as string,
      action: 'purchase.created',
      description: 'Compra registrada',
      userId: input.actorUserId,
      ipAddress: input.ipAddress,
      metadata: { supplierId: input.supplierId, total },
    });

    return purchase;
  }
}
