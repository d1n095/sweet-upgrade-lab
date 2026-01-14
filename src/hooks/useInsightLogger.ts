import { supabase } from '@/integrations/supabase/client';
import { useCallback, useRef } from 'react';

// Generate a session ID for grouping anonymous logs
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('insight_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('insight_session_id', sessionId);
  }
  return sessionId;
};

export const useInsightLogger = () => {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Log search queries (debounced to avoid spam)
  const logSearch = useCallback((searchTerm: string, resultsCount: number) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        await supabase.from('search_logs').insert({
          search_term: searchTerm.trim().toLowerCase(),
          results_count: resultsCount,
          session_id: getSessionId(),
        });
      } catch (error) {
        // Silently fail - logging should not affect UX
        console.error('Failed to log search:', error);
      }
    }, 1000); // 1 second debounce
  }, []);

  // Log interest/product request
  const logInterest = useCallback(async (
    interestType: 'product_request' | 'cbd_interest' | 'category_click' | 'newsletter',
    options?: {
      category?: string;
      message?: string;
      email?: string;
    }
  ) => {
    try {
      await supabase.from('interest_logs').insert({
        interest_type: interestType,
        category: options?.category,
        message: options?.message,
        email: options?.email,
        session_id: getSessionId(),
      });
    } catch (error) {
      // Silently fail
      console.error('Failed to log interest:', error);
    }
  }, []);

  return { logSearch, logInterest };
};

// Standalone functions for use outside of React components
export const logSearchStandalone = async (searchTerm: string, resultsCount: number) => {
  if (!searchTerm.trim() || searchTerm.length < 2) return;
  
  let sessionId = sessionStorage.getItem('insight_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('insight_session_id', sessionId);
  }

  try {
    await supabase.from('search_logs').insert({
      search_term: searchTerm.trim().toLowerCase(),
      results_count: resultsCount,
      session_id: sessionId,
    });
  } catch (error) {
    console.error('Failed to log search:', error);
  }
};

export const logInterestStandalone = async (
  interestType: 'product_request' | 'cbd_interest' | 'category_click' | 'newsletter',
  options?: {
    category?: string;
    message?: string;
    email?: string;
  }
) => {
  let sessionId = sessionStorage.getItem('insight_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('insight_session_id', sessionId);
  }

  try {
    await supabase.from('interest_logs').insert({
      interest_type: interestType,
      category: options?.category,
      message: options?.message,
      email: options?.email,
      session_id: sessionId,
    });
  } catch (error) {
    console.error('Failed to log interest:', error);
  }
};
