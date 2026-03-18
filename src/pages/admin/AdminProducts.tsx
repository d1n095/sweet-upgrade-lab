import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, FlaskConical } from 'lucide-react';
import AdminDbProductManager from '@/components/admin/AdminDbProductManager';
import AdminProductImportExport from '@/components/admin/AdminProductImportExport';
import AdminRecipeIngredientLibrary from '@/components/admin/AdminRecipeIngredientLibrary';

const AdminProducts = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Produkthantering</h1>
          <p className="text-muted-foreground text-sm mt-1">Skapa, redigera och hantera produkter och lager</p>
        </div>
        <AdminProductImportExport />
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="products" className="gap-1.5 text-xs">
            <Package className="w-3.5 h-3.5" /> Produkter
          </TabsTrigger>
          <TabsTrigger value="ingredients" className="gap-1.5 text-xs">
            <FlaskConical className="w-3.5 h-3.5" /> Ingrediensbibliotek
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <AdminDbProductManager />
        </TabsContent>
        <TabsContent value="ingredients">
          <AdminRecipeIngredientLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminProducts;
