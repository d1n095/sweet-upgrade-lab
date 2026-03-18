import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from './useAdminRole';

export interface PageSection {
  id: string;
  page: string;
  section_key: string;
  title_sv: string;
  title_en: string;
  content_sv: string;
  content_en: string;
  icon: string | null;
  is_visible: boolean;
  display_order: number;
}

export const usePageSections = (page: string) => {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAdminRole();

  const fetchSections = async () => {
    setLoading(true);
    const query = supabase
      .from('page_sections')
      .select('*')
      .eq('page', page)
      .order('display_order', { ascending: true });

    const { data, error } = await query;
    if (!error && data) {
      setSections(data as unknown as PageSection[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSections();
  }, [page, isAdmin]);

  const getSection = (key: string) => sections.find(s => s.section_key === key);
  const isSectionVisible = (key: string) => {
    const section = getSection(key);
    return section ? section.is_visible : true;
  };

  return { sections, loading, getSection, isSectionVisible, refetch: fetchSections };
};
