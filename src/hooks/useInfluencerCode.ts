import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

interface InfluencerValidation {
  influencer_id: string;
  influencer_name: string;
  is_valid: boolean;
  message: string;
  products_remaining: number;
}

interface ReceivedProduct {
  product_id: string;
  product_title: string;
}

export const useInfluencerCode = () => {
  const { language } = useLanguage();
  const [isValidating, setIsValidating] = useState(false);
  const [validatedInfluencer, setValidatedInfluencer] = useState<InfluencerValidation | null>(null);
  const [receivedProducts, setReceivedProducts] = useState<ReceivedProduct[]>([]);

  const content = {
    sv: {
      validCode: 'Kod godkänd!',
      invalidCode: 'Ogiltig kod',
      freeProducts: 'gratis produkter kvar',
      alreadyReceived: 'Du har redan fått denna produkt',
      productAdded: 'Gratis produkt tillagd!',
      error: 'Något gick fel vid validering',
    },
    en: {
      validCode: 'Code approved!',
      invalidCode: 'Invalid code',
      freeProducts: 'free products remaining',
      alreadyReceived: 'You already received this product',
      productAdded: 'Free product added!',
      error: 'Something went wrong during validation',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  const validateCode = useCallback(async (code: string, email: string) => {
    if (!code || !email) return null;
    
    setIsValidating(true);
    try {
      const { data, error } = await supabase
        .rpc('validate_influencer_code', { 
          p_code: code.toUpperCase(), 
          p_email: email.toLowerCase() 
        });

      if (error) throw error;

      const result = data?.[0] as InfluencerValidation | undefined;
      
      if (result?.is_valid) {
        setValidatedInfluencer(result);
        toast.success(`${t.validCode} ${result.products_remaining} ${t.freeProducts}`);
        
        // Load already received products
        const { data: products } = await supabase
          .from('influencer_products')
          .select('shopify_product_id, product_title')
          .eq('influencer_id', result.influencer_id);
        
        setReceivedProducts((products || []).map(p => ({ product_id: p.shopify_product_id, product_title: p.product_title })) as ReceivedProduct[]);
        
        return result;
      } else {
        setValidatedInfluencer(null);
        toast.error(result?.message || t.invalidCode);
        return null;
      }
    } catch (error) {

      toast.error(t.error);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [language, t]);

  const isProductReceived = useCallback((productId: string) => {
    return receivedProducts.some(p => p.product_id === productId);
  }, [receivedProducts]);

  const registerFreeProduct = useCallback(async (
    productId: string,
    variantId: string | null,
    productTitle: string
  ) => {
    if (!validatedInfluencer) return false;

    // Check if already received
    if (isProductReceived(productId)) {
      toast.error(t.alreadyReceived);
      return false;
    }

    try {
      // Insert the product record
      const { error: insertError } = await supabase
        .from('influencer_products')
        .insert({
          influencer_id: validatedInfluencer.influencer_id,
          product_id: productId,
          variant_id: variantId,
          product_title: productTitle,
        });

      if (insertError) throw insertError;

      // Update products_used count
      const { error: updateError } = await supabase
        .from('influencers')
        .update({ 
          products_used: validatedInfluencer.products_remaining > 0 
            ? validatedInfluencer.products_remaining - 1 
            : 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', validatedInfluencer.influencer_id);

      if (updateError) throw updateError;

      // Update local state
      setReceivedProducts(prev => [...prev, { 
        product_id: productId, 
        product_title: productTitle 
      }]);
      
      setValidatedInfluencer(prev => prev ? {
        ...prev,
        products_remaining: prev.products_remaining - 1
      } : null);

      toast.success(t.productAdded);
      return true;
    } catch (error) {

      toast.error(t.error);
      return false;
    }
  }, [validatedInfluencer, isProductReceived, t]);

  const clearValidation = useCallback(() => {
    setValidatedInfluencer(null);
    setReceivedProducts([]);
  }, []);

  return {
    isValidating,
    validatedInfluencer,
    receivedProducts,
    validateCode,
    isProductReceived,
    registerFreeProduct,
    clearValidation,
  };
};
