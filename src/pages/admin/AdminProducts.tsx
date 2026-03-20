import { useState, useEffect } from 'react';
import { Package, FlaskConical, ChefHat, AlertTriangle, Eye, FileText, Archive, Image, BarChart3, Clock, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import AdminDbProductManager from '@/components/admin/AdminDbProductManager';
import AdminProductImportExport from '@/components/admin/AdminProductImportExport';
import AdminRecipeIngredientLibrary from '@/components/admin/AdminRecipeIngredientLibrary';
import AdminRecipeTemplateBuilder from '@/components/admin/AdminRecipeTemplateBuilder';
import AdminImageGallery from '@/components/admin/AdminImageGallery';
import AdminSearchAnalytics from '@/components/admin/AdminSearchAnalytics';

const AdminProducts = () => {
  const [stats, setStats] = useState({ total: 0, visible: 0, lowStock: 0, ingredients: 0, drafts: 0, archived: 0, comingSoon: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('products');

  useEffect(() => {
    const load = async () => {
      const [{ data: products }, { count: ingredients }] = await Promise.all([
        supabase.from('products').select('id, is_visible, stock, allow_overselling, status'),
        supabase.from('recipe_ingredients').select('*', { count: 'exact', head: true }),
      ]);
      const prods = (products || []) as any[];
      const active = prods.filter(p => (p.status || 'active') === 'active');
      setStats({
        total: active.length,
        visible: active.filter(p => p.is_visible).length,
        lowStock: active.filter(p => !p.allow_overselling && p.stock <= 5).length,
        ingredients: ingredients || 0,
        drafts: prods.filter(p => p.status === 'draft').length,
        archived: prods.filter(p => p.status === 'archived').length,
        comingSoon: prods.filter(p => p.status === 'coming_soon').length,
        info: prods.filter(p => p.status === 'info').length,
      });
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Produkthantering</h1>
          <p className="text-muted-foreground text-sm mt-1">Skapa, redigera och hantera produkter och lager</p>
        </div>
        <AdminProductImportExport />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
        {[
          { label: 'Aktiva', value: stats.total, icon: Package, color: 'text-primary', tab: 'products' },
          { label: 'Synliga', value: stats.visible, icon: Eye, color: 'text-green-600', tab: 'products' },
          { label: 'Kommer snart', value: stats.comingSoon, icon: Clock, color: 'text-amber-600', tab: 'products' },
          { label: 'Info', value: stats.info, icon: Info, color: 'text-blue-600', tab: 'products' },
          { label: 'Utkast', value: stats.drafts, icon: FileText, color: 'text-amber-600', tab: 'products' },
          { label: 'Arkiverade', value: stats.archived, icon: Archive, color: 'text-blue-600', tab: 'products' },
          { label: 'Lågt lager', value: stats.lowStock, icon: AlertTriangle, color: 'text-orange-600', tab: 'products' },
          { label: 'Ingredienser', value: stats.ingredients, icon: FlaskConical, color: 'text-purple-600', tab: 'ingredients' },
        ].map(s => (
          <Card
            key={s.label}
            className="border-border cursor-pointer hover:bg-secondary/50 hover:shadow-sm transition-all active:scale-[0.97]"
            onClick={() => setActiveMainTab(s.tab)}
          >
            <CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{s.label}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold">{loading ? '–' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-4">
        <ScrollableTabs>
          <TabsList className="w-max">
            <TabsTrigger value="products" className="gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5" /> Produkter
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="gap-1.5 text-xs">
              <FlaskConical className="w-3.5 h-3.5" /> Ingrediensbibliotek
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-1.5 text-xs">
              <ChefHat className="w-3.5 h-3.5" /> Receptmallar
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1.5 text-xs">
              <Image className="w-3.5 h-3.5" /> Bildgalleri
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Sökdata
            </TabsTrigger>
          </TabsList>
        </ScrollableTabs>

        <TabsContent value="products"><AdminDbProductManager /></TabsContent>
        <TabsContent value="ingredients"><AdminRecipeIngredientLibrary /></TabsContent>
        <TabsContent value="recipes"><AdminRecipeTemplateBuilder /></TabsContent>
        <TabsContent value="gallery"><AdminImageGallery /></TabsContent>
        <TabsContent value="search"><AdminSearchAnalytics /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminProducts;
