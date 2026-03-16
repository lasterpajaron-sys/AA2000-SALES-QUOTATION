import type { Product } from '../types';

/** Backend product shape (from Sequelize Product model) */
interface BackendProduct {
  prod_ID: number;
  prod_Code?: string | null;
  prod_Name?: string | null;
  image_base64?: string | null;
  prod_CategoryID?: number | null;
  prod_supplierID?: number | null;
  prob_status?: string | null;
  prod_price?: number | null;
}

function getProductsUrl(): string {
  const base = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ?? '';
  const pathOverride = (import.meta as any).env?.VITE_PRODUCTS_PATH as string | undefined;
  const baseClean = base.replace(/\/+$/, '');
  if (pathOverride != null && pathOverride.trim() !== '') {
    const p = pathOverride.trim().replace(/^\/+/, '/');
    return `${baseClean}${p}`;
  }
  // Default: backend routes are mounted under /products with
  //   router.get('/get/products', ...)
  // and router is mounted as app.use('/products', router)
  // → full path: /products/get/products
  //
  // If your mounting changes in the future, override via VITE_PRODUCTS_PATH
  // e.g. VITE_PRODUCTS_PATH=/api/products/get/products
  return `${baseClean}/products/get/products`;
}

function mapBackendProductToFrontend(row: BackendProduct): Product {
  const id = Number(row.prod_ID ?? 0);
  const code = String(row.prod_Code ?? '').trim();
  const name = String(row.prod_Name ?? '').trim();
  const priceNum = Number(row.prod_price ?? 0);
  const baseCost = priceNum;
  const price = priceNum;
  const category = row.prod_CategoryID != null ? String(row.prod_CategoryID) : '';
  return {
    id,
    model: code || name || String(id),
    name: name || code || '—',
    description: name ? `Product: ${name}` : '',
    brand: '',
    baseCost,
    price,
    category: category || undefined,
    dealerPrice: baseCost * 1.3,
    contractorPrice: baseCost * 1.15,
    endUserPrice: price,
    dealerBigVolumePrice: baseCost * 1.2,
    contractorBigVolumePrice: baseCost * 1.1,
    endUserBigVolumePrice: baseCost * 1.3,
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const url = getProductsUrl();
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.status}`);
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.data ?? []);
  return list
    .filter((row: unknown) => row != null && typeof row === 'object')
    .map((row: Record<string, unknown>) =>
      mapBackendProductToFrontend({
        prod_ID: Number(row.prod_ID ?? row.prod_id ?? 0),
        prod_Code: row.prod_Code ?? row.prod_code ?? null,
        prod_Name: row.prod_Name ?? row.prod_name ?? null,
        image_base64: row.image_base64 ?? null,
        prod_CategoryID: row.prod_CategoryID ?? row.prod_categoryID ?? null,
        prod_supplierID: row.prod_supplierID ?? row.prod_supplierID ?? null,
        prob_status: row.prob_status ?? row.prod_status ?? null,
        prod_price: row.prod_price ?? row.prod_price ?? null,
      })
    );
}
