import { fetchDbProducts, DbProduct } from '@/lib/products';

/**
 * Generic product type used throughout the application.
 * All product data is sourced from the local `products` database table.
 */
export interface Product {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    productType?: string;
    priceRange: {
      minVariantPrice: {
        amount: string;
        currencyCode: string;
      };
    };
    images: {
      edges: Array<{
        node: {
          url: string;
          altText: string | null;
        };
      }>;
    };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: {
            amount: string;
            currencyCode: string;
          };
          availableForSale: boolean;
          quantityAvailable?: number | null;
          selectedOptions: Array<{
            name: string;
            value: string;
          }>;
        };
      }>;
    };
    options: Array<{
      name: string;
      values: string[];
    }>;
  };
}

/**
 * Converts a database product row into the generic Product shape.
 */
export function dbProductToProduct(db: DbProduct): Product {
  const currencyCode = db.currency || 'SEK';
  const amount = String(db.price);

  return {
    node: {
      id: db.id,
      title: db.title_sv,
      description: db.description_sv || '',
      handle: db.handle || db.id,
      productType: db.category || undefined,
      priceRange: {
        minVariantPrice: { amount, currencyCode },
      },
      images: {
        edges: (db.image_urls || []).map((url) => ({
          node: { url, altText: null },
        })),
      },
      variants: {
        edges: [
          {
            node: {
              id: `${db.id}-variant`,
              title: 'Default Title',
              price: { amount, currencyCode },
              availableForSale: db.stock > 0 || db.allow_overselling,
              quantityAvailable: db.stock,
              selectedOptions: [],
            },
          },
        ],
      },
      options: [],
    },
  };
}

/**
 * Fetch products from the database.
 *
 * Accepts an optional query string for filtering:
 *   - `product_type:<value>` → filters by category
 *   - `title:*<keyword>*`   → filters by title (case-insensitive)
 * Multiple clauses joined with ` AND ` are supported.
 */
export async function fetchProducts(first = 50, query?: string): Promise<Product[]> {
  const rows = await fetchDbProducts();

  let filtered = rows;

  if (query) {
    const productTypeMatch = query.match(/product_type:([^\s]+)/);
    const titleMatch = query.match(/title:\*([^*]+)\*/);

    if (productTypeMatch) {
      const productType = productTypeMatch[1];
      filtered = filtered.filter((p) => p.category === productType);
    }

    if (titleMatch) {
      const search = titleMatch[1].toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title_sv.toLowerCase().includes(search) ||
          (p.title_en || '').toLowerCase().includes(search)
      );
    }
  }

  return filtered.slice(0, first).map(dbProductToProduct);
}
