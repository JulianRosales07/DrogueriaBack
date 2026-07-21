import { getSupabaseClient, throwIfError } from '@core/database/connection';
import { ApiError } from '@shared/errors/ApiError';
import { createAuditLog } from '@shared/utils/audit';
import { generateId } from '@shared/utils/cuid';

type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitCost: number;
  unitFactor?: number;
  unitLabel?: string;
  productUnitId?: string | null;
};

export type PurchasePaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

type PurchaseInput = {
  supplierId: string;
  invoiceNumber?: string;
  notes?: string;
  tax?: number;
  items: PurchaseItemInput[];
  paymentStatus?: PurchasePaymentStatus;
  amountPaid?: number;
  actorUserId: string;
  ipAddress?: string;
  storeId: string;
};

type RegisterPaymentInput = {
  purchaseId: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  note?: string;
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
         purchase_items(id, product_id, quantity, unit_cost, line_total, unit_label, unit_factor, unit_quantity, products(name)),
         supplier_payments(id, amount, payment_method, note, created_at)`
      )
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    throwIfError(error);
    return data;
  }

  /**
   * Cuentas por pagar: total pendiente agrupado por proveedor, considerando
   * solo compras con saldo (PENDING o PARTIAL).
   */
  async outstandingBySupplier(storeId: string) {
    const { data, error } = await this.client
      .from('purchases')
      .select('supplier_id, total, amount_paid, payment_status, suppliers(business_name)')
      .eq('store_id', storeId)
      .in('payment_status', ['PENDING', 'PARTIAL']);
    throwIfError(error);

    const bySupplier = new Map<string, { supplierId: string; supplierName: string; balance: number; purchaseCount: number }>();
    for (const row of data || []) {
      const balance = Number(row.total) - Number(row.amount_paid);
      const existing = bySupplier.get(row.supplier_id);
      const supplierName = (row as any).suppliers?.business_name ?? 'Desconocido';
      if (existing) {
        existing.balance += balance;
        existing.purchaseCount += 1;
      } else {
        bySupplier.set(row.supplier_id, {
          supplierId: row.supplier_id,
          supplierName,
          balance,
          purchaseCount: 1,
        });
      }
    }

    return Array.from(bySupplier.values()).sort((a, b) => b.balance - a.balance);
  }

  async create(input: PurchaseInput) {
    if (!input.items?.length) {
      throw ApiError.badRequest('La compra debe incluir al menos un ítem');
    }

    const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
      + (input.tax ?? 0);

    const paymentStatus = input.paymentStatus ?? 'PAID';
    if (paymentStatus === 'PARTIAL') {
      const amountPaid = input.amountPaid ?? 0;
      if (amountPaid <= 0 || amountPaid >= total) {
        throw ApiError.badRequest('El monto abonado debe ser mayor a 0 y menor al total para un pago parcial');
      }
    }

    const { data: purchaseId, error } = await this.client.rpc('create_purchase', {
      p_supplier_id: input.supplierId,
      p_user_id: input.actorUserId,
      p_invoice_number: input.invoiceNumber || null,
      p_notes: input.notes || null,
      p_tax: input.tax ?? 0,
      p_store_id: input.storeId,
      p_payment_status: paymentStatus,
      p_amount_paid: paymentStatus === 'PARTIAL' ? input.amountPaid : null,
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
      metadata: { supplierId: input.supplierId, total, paymentStatus },
    });

    return purchase;
  }

  /**
   * Registra un abono/pago a una compra existente. Actualiza amount_paid y
   * recalcula payment_status (PENDING -> PARTIAL -> PAID) según el saldo restante.
   */
  async registerPayment(input: RegisterPaymentInput) {
    if (input.amount <= 0) {
      throw ApiError.badRequest('El monto del pago debe ser mayor a 0');
    }

    const { data: purchase, error: fetchError } = await this.client
      .from('purchases')
      .select('id, supplier_id, total, amount_paid, payment_status')
      .eq('id', input.purchaseId)
      .eq('store_id', input.storeId)
      .maybeSingle();
    throwIfError(fetchError);

    if (!purchase) {
      throw ApiError.notFound('Compra no encontrada');
    }
    if (purchase.payment_status === 'PAID') {
      throw ApiError.badRequest('Esta compra ya está pagada en su totalidad');
    }

    const currentPaid = Number(purchase.amount_paid);
    const total = Number(purchase.total);
    const remaining = total - currentPaid;

    if (input.amount > remaining) {
      throw ApiError.badRequest(`El pago (${input.amount}) supera el saldo pendiente (${remaining})`);
    }

    const newAmountPaid = currentPaid + input.amount;
    const newStatus = newAmountPaid >= total ? 'PAID' : 'PARTIAL';

    const { error: updateError } = await this.client
      .from('purchases')
      .update({ amount_paid: newAmountPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', input.purchaseId)
      .eq('store_id', input.storeId);
    throwIfError(updateError);

    const { error: insertError } = await this.client.from('supplier_payments').insert({
      id: generateId(),
      store_id: input.storeId,
      purchase_id: input.purchaseId,
      supplier_id: purchase.supplier_id,
      user_id: input.actorUserId,
      amount: input.amount,
      payment_method: input.paymentMethod ?? 'CASH',
      note: input.note || null,
    });
    throwIfError(insertError);

    await createAuditLog({
      entityType: 'purchase',
      entityId: input.purchaseId,
      action: 'purchase.payment_registered',
      description: `Pago a proveedor registrado: ${input.amount}`,
      userId: input.actorUserId,
      ipAddress: input.ipAddress,
      metadata: { amount: input.amount, newAmountPaid, newStatus },
    });

    const { data: updated, error: refetchError } = await this.client
      .from('purchases')
      .select(
        `*, suppliers(business_name),
         purchase_items(id, product_id, quantity, unit_cost, line_total, unit_label, unit_factor, unit_quantity, products(name)),
         supplier_payments(id, amount, payment_method, note, created_at)`
      )
      .eq('id', input.purchaseId)
      .single();
    throwIfError(refetchError);

    return updated;
  }
}
