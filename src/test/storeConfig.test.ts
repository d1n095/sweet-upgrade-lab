import { describe, it, expect } from 'vitest';
import { storeConfig } from '@/config/storeConfig';

describe('storeConfig', () => {
  describe('shipping', () => {
    it('has a positive shipping cost', () => {
      expect(storeConfig.shipping.cost).toBeGreaterThan(0);
    });

    it('free shipping threshold is above shipping cost', () => {
      expect(storeConfig.shipping.freeShippingThreshold).toBeGreaterThan(storeConfig.shipping.cost);
    });

    it('generous free min is below the standard free shipping threshold', () => {
      expect(storeConfig.shipping.generousFreeMin).toBeLessThan(
        storeConfig.shipping.freeShippingThreshold
      );
    });

    it('generous free max is above the standard free shipping threshold', () => {
      expect(storeConfig.shipping.generousFreeMax).toBeGreaterThan(
        storeConfig.shipping.freeShippingThreshold
      );
    });

    it('provides Swedish delivery time string', () => {
      expect(storeConfig.shipping.deliveryTime.sv).toBeTruthy();
    });

    it('provides English delivery time string', () => {
      expect(storeConfig.shipping.deliveryTime.en).toBeTruthy();
    });
  });

  describe('returns', () => {
    it('return period is a positive number', () => {
      expect(storeConfig.returns.period).toBeGreaterThan(0);
    });
  });

  describe('stock thresholds', () => {
    it('low stock threshold is positive', () => {
      expect(storeConfig.stock.lowStockThreshold).toBeGreaterThan(0);
    });

    it('very low stock threshold is less than low stock threshold', () => {
      expect(storeConfig.stock.veryLowStockThreshold).toBeLessThan(
        storeConfig.stock.lowStockThreshold
      );
    });

    it('very low stock threshold is positive', () => {
      expect(storeConfig.stock.veryLowStockThreshold).toBeGreaterThan(0);
    });
  });

  describe('categories', () => {
    it('has at least one category', () => {
      expect(storeConfig.categories.length).toBeGreaterThan(0);
    });

    it('every category has a unique id', () => {
      const ids = storeConfig.categories.map((c) => c.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('every category has a Swedish and English name', () => {
      for (const category of storeConfig.categories) {
        expect(category.name.sv).toBeTruthy();
        expect(category.name.en).toBeTruthy();
      }
    });

    it('every category has a shopifyProductType', () => {
      for (const category of storeConfig.categories) {
        expect(typeof category.shopifyProductType).toBe('string');
      }
    });

    it('every category has an active flag', () => {
      for (const category of storeConfig.categories) {
        expect(typeof category.active).toBe('boolean');
      }
    });
  });

  describe('currency', () => {
    it('has a currency code', () => {
      expect(storeConfig.currency.code).toBeTruthy();
    });

    it('has a currency symbol', () => {
      expect(storeConfig.currency.symbol).toBeTruthy();
    });

    it('has a locale', () => {
      expect(storeConfig.currency.locale).toBeTruthy();
    });
  });

  describe('company', () => {
    it('has a company name', () => {
      expect(storeConfig.company.name).toBeTruthy();
    });

    it('has Swedish and English taglines', () => {
      expect(storeConfig.company.tagline.sv).toBeTruthy();
      expect(storeConfig.company.tagline.en).toBeTruthy();
    });
  });

  describe('contact', () => {
    it('has a support email', () => {
      expect(storeConfig.contact.email).toMatch(/@/);
    });
  });

  describe('siteUrl', () => {
    it('is a valid URL', () => {
      expect(() => new URL(storeConfig.siteUrl)).not.toThrow();
    });
  });
});
