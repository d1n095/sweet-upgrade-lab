import { useState, useEffect } from 'react';
import { Package, FlaskConical, ChefHat, AlertTriangle, Eye, FileText, Archive, Image } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import AdminDbProductManager from '@/components/admin/AdminDbProductManager';
import AdminProductImportExport from '@/components/admin/AdminProductImportExport';
import AdminRecipeIngredientLibrary from '@/components/admin/AdminRecipeIngredientLibrary';
import AdminRecipeTemplateBuilder from '@/components/admin/AdminRecipeTemplateBuilder';
import AdminImageGallery from '@/components/admin/AdminImageGallery';

const AdminProducts = () => {
  const [stats, setStats] = useState({ total: 0, visible: 0, lowStock: 0, ingredients: 0, drafts: 0, archived: 0 });
  const [loading, setLoading] = useState(true);

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

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: 'Aktiva', value: stats.total, icon: Package, color: 'text-primary' },
          { label: 'Synliga', value: stats.visible, icon: Eye, color: 'text-green-600' },
          { label: 'Utkast', value: stats.drafts, icon: FileText, color: 'text-amber-600' },
          { label: 'Arkiverade', value: stats.archived, icon: Archive, color: 'text-blue-600' },
          { label: 'Lågt lager', value: stats.lowStock, icon: AlertTriangle, color: 'text-orange-600' },
          { label: 'Ingredienser', value: stats.ingredients, icon: FlaskConical, color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold">{loading ? '–' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="products" className="space-y-4">
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
          </TabsList>
        </ScrollableTabs>

        <TabsContent value="products"><AdminDbProductManager /></TabsContent>
        <TabsContent value="ingredients"><AdminRecipeIngredientLibrary /></TabsContent>
        <TabsContent value="recipes"><AdminRecipeTemplateBuilder /></TabsContent>
        <TabsContent value="gallery"><AdminImageGallery /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminProducts;
