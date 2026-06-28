export type ProductStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Product {
  id?: number;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  price: number;
  status?: ProductStatus;
}
