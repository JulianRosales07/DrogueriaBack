import { getSupabaseClient, throwIfError } from '@core/database/connection';

export class DashboardService {
  private get client() {
    return getSupabaseClient();
  }

  async summary(storeId: string) {
    const [
      { count: products, error: e1 },
      { count: customers, error: e2 },
      { count: suppliers, error: e3 },
      { count: salesCount, error: e4 },
      { count: purchasesCount, error: e5 },
    ] = await Promise.all([
      this.client.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
      this.client.from('customers').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
      this.client.from('suppliers').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
      this.client.from('sales').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
      this.client.from('purchases').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
    ]);
    throwIfError(e1); throwIfError(e2); throwIfError(e3); throwIfError(e4); throwIfError(e5);

    const { data: recentSales, error: e6 } = await this.client
      .from('sales')
      .select('*, customers(full_name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5);
    throwIfError(e6);

    const { data: recentPurchases, error: e7 } = await this.client
      .from('purchases')
      .select('*, suppliers(business_name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5);
    throwIfError(e7);

    const { data: products_, error: e8 } = await this.client
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('stock', { ascending: true });
    throwIfError(e8);

    const lowStock = (products_ || []).filter((p: any) => p.stock <= p.min_stock).slice(0, 10);

    return {
      counts: {
        products: products || 0,
        customers: customers || 0,
        suppliers: suppliers || 0,
        sales: salesCount || 0,
        purchases: purchasesCount || 0,
      },
      recentSales,
      recentPurchases,
      lowStock,
    };
  }
}
