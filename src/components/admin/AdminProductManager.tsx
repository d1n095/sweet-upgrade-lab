import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Package, Edit, Trash2, Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AdminProductForm,
  type AdminProductFormStrings,
  type ProductFormData,
} from '@/components/admin/AdminProductForm';

// Product categories
const productCategories = [
  { value: 'Kroppsvård', label: { sv: 'Kroppsvård', en: 'Body Care' } },
  { value: 'Elektronik', label: { sv: 'Elektronik', en: 'Electronics' } },
  { value: 'Mode', label: { sv: 'Mode', en: 'Fashion' } },
  { value: 'Ljus', label: { sv: 'Ljus', en: 'Candles' } },
  { value: 'Smycken', label: { sv: 'Smycken & Silver', en: 'Jewelry & Silver' } },
  { value: 'Bastudofter', label: { sv: 'Bastudofter', en: 'Sauna Scents' } },
  { value: 'Hemtextil', label: { sv: 'Hemtextil', en: 'Home Textiles' } },
  { value: 'CBD', label: { sv: 'CBD', en: 'CBD' } },
];

// Suggested tags
const suggestedTags = [
  'naturlig', 'ekologisk', 'vegansk', 'giftfri', 'hållbar', 
  'handgjord', 'svensktillverkad', 'nyhet', 'bästsäljare', 'limited'
];

const gidToNumericId = (gid: string | undefined | null) => {
  if (!gid) return null;
  const id = gid.split('/').pop();
  return id || null;
};

const AdminProductManager = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    price: '',
    productType: '',
    tags: '',
    vendor: '4ThePeople',
    isVisible: true,
    inventory: 0,
    allowOverselling: false,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => fetchProducts(50),
  });

  const content: Record<string, AdminProductFormStrings & {
    title: string;
    subtitle: string;
    addProduct: string;
    editProduct: string;
    delete: string;
    noProducts: string;
    loading: string;
    deleteConfirm: string;
    deleteDescription: string;
    productAdded: string;
    productUpdated: string;
    productDeleted: string;
    error: string;
    inStock: string;
    outOfStock: string;
    moreProducts: string;
  }> = {
    sv: {
      title: 'Produkthantering',
      subtitle: 'Lägg till, redigera och ta bort produkter',
      addProduct: 'Lägg till produkt',
      editProduct: 'Redigera produkt',
      productName: 'Produktnamn',
      description: 'Beskrivning',
      price: 'Pris (SEK)',
      category: 'Kategori',
      selectCategory: 'Välj kategori',
      tags: 'Taggar',
      tagsPlaceholder: 'Klicka på förslag eller skriv egna',
      suggestedTags: 'Föreslagna taggar:',
      vendor: 'Leverantör',
      save: 'Spara produkt',
      update: 'Uppdatera',
      cancel: 'Avbryt',
      delete: 'Ta bort',
      noProducts: 'Inga produkter hittades',
      loading: 'Laddar produkter...',
      deleteConfirm: 'Är du säker?',
      deleteDescription: 'Denna åtgärd kan inte ångras. Produkten tas bort permanent.',
      productAdded: 'Produkt tillagd!',
      productUpdated: 'Produkt uppdaterad!',
      productDeleted: 'Produkt borttagen!',
      error: 'Något gick fel',
      inStock: 'I lager',
      outOfStock: 'Slut',
      moreProducts: 'fler produkter',
      visibility: 'Synlighet',
      visibleInStore: 'Synlig i butiken',
      hiddenFromStore: 'Dold från butiken',
      inventory: 'Lager',
      currentStock: 'Nuvarande lager',
      allowOverselling: 'Tillåt försäljning när slut',
      oversellHint: 'Kunder kan köpa även när lagret är 0',
    },
    en: {
      title: 'Product Management',
      subtitle: 'Add, edit and delete products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      productName: 'Product Name',
      description: 'Description',
      price: 'Price (SEK)',
      category: 'Category',
      selectCategory: 'Select category',
      tags: 'Tags',
      tagsPlaceholder: 'Click suggestions or type your own',
      suggestedTags: 'Suggested tags:',
      vendor: 'Vendor',
      save: 'Save Product',
      update: 'Update',
      cancel: 'Cancel',
      delete: 'Delete',
      noProducts: 'No products found',
      loading: 'Loading products...',
      deleteConfirm: 'Are you sure?',
      deleteDescription: 'This action cannot be undone. The product will be permanently deleted.',
      productAdded: 'Product added!',
      productUpdated: 'Product updated!',
      productDeleted: 'Product deleted!',
      error: 'Something went wrong',
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      moreProducts: 'more products',
      visibility: 'Visibility',
      visibleInStore: 'Visible in store',
      hiddenFromStore: 'Hidden from store',
      inventory: 'Inventory',
      currentStock: 'Current stock',
      allowOverselling: 'Allow overselling',
      oversellHint: 'Customers can buy even when stock is 0',
    },
    no: {
      title: 'Produkthåndtering',
      subtitle: 'Legg til, rediger og slett produkter',
      addProduct: 'Legg til produkt',
      editProduct: 'Rediger produkt',
      productName: 'Produktnavn',
      description: 'Beskrivelse',
      price: 'Pris (SEK)',
      category: 'Kategori',
      selectCategory: 'Velg kategori',
      tags: 'Tagger',
      tagsPlaceholder: 'Klikk på forslag eller skriv egne',
      suggestedTags: 'Foreslåtte tagger:',
      vendor: 'Leverandør',
      save: 'Lagre produkt',
      update: 'Oppdater',
      cancel: 'Avbryt',
      delete: 'Slett',
      noProducts: 'Ingen produkter funnet',
      loading: 'Laster produkter...',
      deleteConfirm: 'Er du sikker?',
      deleteDescription: 'Denne handlingen kan ikke angres. Produktet slettes permanent.',
      productAdded: 'Produkt lagt til!',
      productUpdated: 'Produkt oppdatert!',
      productDeleted: 'Produkt slettet!',
      error: 'Noe gikk galt',
      inStock: 'På lager',
      outOfStock: 'Utsolgt',
      moreProducts: 'flere produkter',
      visibility: 'Synlighet',
      visibleInStore: 'Synlig i butikk',
      hiddenFromStore: 'Skjult fra butikk',
      inventory: 'Lager',
      currentStock: 'Nåværende lager',
      allowOverselling: 'Tillat oversalg',
      oversellHint: 'Kunder kan kjøpe selv når lager er 0',
    },
    da: {
      title: 'Produkthåndtering',
      subtitle: 'Tilføj, rediger og slet produkter',
      addProduct: 'Tilføj produkt',
      editProduct: 'Rediger produkt',
      productName: 'Produktnavn',
      description: 'Beskrivelse',
      price: 'Pris (SEK)',
      category: 'Kategori',
      selectCategory: 'Vælg kategori',
      tags: 'Tags',
      tagsPlaceholder: 'Klik på forslag eller skriv egne',
      suggestedTags: 'Foreslåede tags:',
      vendor: 'Leverandør',
      save: 'Gem produkt',
      update: 'Opdater',
      cancel: 'Annuller',
      delete: 'Slet',
      noProducts: 'Ingen produkter fundet',
      loading: 'Indlæser produkter...',
      deleteConfirm: 'Er du sikker?',
      deleteDescription: 'Denne handling kan ikke fortrydes. Produktet slettes permanent.',
      productAdded: 'Produkt tilføjet!',
      productUpdated: 'Produkt opdateret!',
      productDeleted: 'Produkt slettet!',
      error: 'Noget gik galt',
      inStock: 'På lager',
      outOfStock: 'Udsolgt',
      moreProducts: 'flere produkter',
      visibility: 'Synlighed',
      visibleInStore: 'Synlig i butik',
      hiddenFromStore: 'Skjult fra butik',
      inventory: 'Lager',
      currentStock: 'Nuværende lager',
      allowOverselling: 'Tillad oversalg',
      oversellHint: 'Kunder kan købe selv når lager er 0',
    },
    de: {
      title: 'Produktverwaltung',
      subtitle: 'Produkte hinzufügen, bearbeiten und löschen',
      addProduct: 'Produkt hinzufügen',
      editProduct: 'Produkt bearbeiten',
      productName: 'Produktname',
      description: 'Beschreibung',
      price: 'Preis (SEK)',
      category: 'Kategorie',
      selectCategory: 'Kategorie wählen',
      tags: 'Tags',
      tagsPlaceholder: 'Klicken Sie auf Vorschläge oder schreiben Sie eigene',
      suggestedTags: 'Vorgeschlagene Tags:',
      vendor: 'Lieferant',
      save: 'Produkt speichern',
      update: 'Aktualisieren',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      noProducts: 'Keine Produkte gefunden',
      loading: 'Produkte werden geladen...',
      deleteConfirm: 'Sind Sie sicher?',
      deleteDescription: 'Diese Aktion kann nicht rückgängig gemacht werden. Das Produkt wird dauerhaft gelöscht.',
      productAdded: 'Produkt hinzugefügt!',
      productUpdated: 'Produkt aktualisiert!',
      productDeleted: 'Produkt gelöscht!',
      error: 'Etwas ist schief gelaufen',
      inStock: 'Auf Lager',
      outOfStock: 'Ausverkauft',
      moreProducts: 'weitere Produkte',
      visibility: 'Sichtbarkeit',
      visibleInStore: 'Im Shop sichtbar',
      hiddenFromStore: 'Vom Shop versteckt',
      inventory: 'Bestand',
      currentStock: 'Aktueller Bestand',
      allowOverselling: 'Überverkauf erlauben',
      oversellHint: 'Kunden können kaufen, auch wenn der Bestand 0 ist',
    },
    fi: {
      title: 'Tuotehallinta',
      subtitle: 'Lisää, muokkaa ja poista tuotteita',
      addProduct: 'Lisää tuote',
      editProduct: 'Muokkaa tuotetta',
      productName: 'Tuotenimi',
      description: 'Kuvaus',
      price: 'Hinta (SEK)',
      category: 'Kategoria',
      selectCategory: 'Valitse kategoria',
      tags: 'Tagit',
      tagsPlaceholder: 'Klikkaa ehdotuksia tai kirjoita omia',
      suggestedTags: 'Ehdotetut tagit:',
      vendor: 'Toimittaja',
      save: 'Tallenna tuote',
      update: 'Päivitä',
      cancel: 'Peruuta',
      delete: 'Poista',
      noProducts: 'Tuotteita ei löytynyt',
      loading: 'Ladataan tuotteita...',
      deleteConfirm: 'Oletko varma?',
      deleteDescription: 'Tätä toimintoa ei voi peruuttaa. Tuote poistetaan pysyvästi.',
      productAdded: 'Tuote lisätty!',
      productUpdated: 'Tuote päivitetty!',
      productDeleted: 'Tuote poistettu!',
      error: 'Jotain meni pieleen',
      inStock: 'Varastossa',
      outOfStock: 'Loppuunmyyty',
      moreProducts: 'lisää tuotteita',
      visibility: 'Näkyvyys',
      visibleInStore: 'Näkyy kaupassa',
      hiddenFromStore: 'Piilotettu kaupasta',
      inventory: 'Varasto',
      currentStock: 'Nykyinen varasto',
      allowOverselling: 'Salli ylimyynti',
      oversellHint: 'Asiakkaat voivat ostaa, vaikka varasto on 0',
    },
    nl: {
      title: 'Productbeheer',
      subtitle: 'Producten toevoegen, bewerken en verwijderen',
      addProduct: 'Product toevoegen',
      editProduct: 'Product bewerken',
      productName: 'Productnaam',
      description: 'Beschrijving',
      price: 'Prijs (SEK)',
      category: 'Categorie',
      selectCategory: 'Selecteer categorie',
      tags: 'Tags',
      tagsPlaceholder: 'Klik op suggesties of typ je eigen',
      suggestedTags: 'Voorgestelde tags:',
      vendor: 'Leverancier',
      save: 'Product opslaan',
      update: 'Bijwerken',
      cancel: 'Annuleren',
      delete: 'Verwijderen',
      noProducts: 'Geen producten gevonden',
      loading: 'Producten laden...',
      deleteConfirm: 'Weet je het zeker?',
      deleteDescription: 'Deze actie kan niet ongedaan worden gemaakt. Het product wordt permanent verwijderd.',
      productAdded: 'Product toegevoegd!',
      productUpdated: 'Product bijgewerkt!',
      productDeleted: 'Product verwijderd!',
      error: 'Er ging iets mis',
      inStock: 'Op voorraad',
      outOfStock: 'Uitverkocht',
      moreProducts: 'meer producten',
      visibility: 'Zichtbaarheid',
      visibleInStore: 'Zichtbaar in winkel',
      hiddenFromStore: 'Verborgen uit winkel',
      inventory: 'Voorraad',
      currentStock: 'Huidige voorraad',
      allowOverselling: 'Oververkoop toestaan',
      oversellHint: 'Klanten kunnen kopen ook als voorraad 0 is',
    },
    fr: {
      title: 'Gestion des produits',
      subtitle: 'Ajouter, modifier et supprimer des produits',
      addProduct: 'Ajouter un produit',
      editProduct: 'Modifier le produit',
      productName: 'Nom du produit',
      description: 'Description',
      price: 'Prix (SEK)',
      category: 'Catégorie',
      selectCategory: 'Sélectionner une catégorie',
      tags: 'Tags',
      tagsPlaceholder: 'Cliquez sur les suggestions ou tapez les vôtres',
      suggestedTags: 'Tags suggérés :',
      vendor: 'Fournisseur',
      save: 'Enregistrer le produit',
      update: 'Mettre à jour',
      cancel: 'Annuler',
      delete: 'Supprimer',
      noProducts: 'Aucun produit trouvé',
      loading: 'Chargement des produits...',
      deleteConfirm: 'Êtes-vous sûr ?',
      deleteDescription: 'Cette action est irréversible. Le produit sera définitivement supprimé.',
      productAdded: 'Produit ajouté !',
      productUpdated: 'Produit mis à jour !',
      productDeleted: 'Produit supprimé !',
      error: 'Quelque chose a mal tourné',
      inStock: 'En stock',
      outOfStock: 'Épuisé',
      moreProducts: 'produits supplémentaires',
      visibility: 'Visibilité',
      visibleInStore: 'Visible en boutique',
      hiddenFromStore: 'Caché de la boutique',
      inventory: 'Inventaire',
      currentStock: 'Stock actuel',
      allowOverselling: 'Autoriser la survente',
      oversellHint: 'Les clients peuvent acheter même si le stock est à 0',
    },
    es: {
      title: 'Gestión de productos',
      subtitle: 'Agregar, editar y eliminar productos',
      addProduct: 'Agregar producto',
      editProduct: 'Editar producto',
      productName: 'Nombre del producto',
      description: 'Descripción',
      price: 'Precio (SEK)',
      category: 'Categoría',
      selectCategory: 'Seleccionar categoría',
      tags: 'Etiquetas',
      tagsPlaceholder: 'Haz clic en sugerencias o escribe las tuyas',
      suggestedTags: 'Etiquetas sugeridas:',
      vendor: 'Proveedor',
      save: 'Guardar producto',
      update: 'Actualizar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      noProducts: 'No se encontraron productos',
      loading: 'Cargando productos...',
      deleteConfirm: '¿Estás seguro?',
      deleteDescription: 'Esta acción no se puede deshacer. El producto se eliminará permanentemente.',
      productAdded: '¡Producto agregado!',
      productUpdated: '¡Producto actualizado!',
      productDeleted: '¡Producto eliminado!',
      error: 'Algo salió mal',
      inStock: 'En stock',
      outOfStock: 'Agotado',
      moreProducts: 'productos más',
      visibility: 'Visibilidad',
      visibleInStore: 'Visible en tienda',
      hiddenFromStore: 'Oculto de la tienda',
      inventory: 'Inventario',
      currentStock: 'Stock actual',
      allowOverselling: 'Permitir sobreventa',
      oversellHint: 'Los clientes pueden comprar incluso cuando el stock es 0',
    },
    pl: {
      title: 'Zarządzanie produktami',
      subtitle: 'Dodawaj, edytuj i usuwaj produkty',
      addProduct: 'Dodaj produkt',
      editProduct: 'Edytuj produkt',
      productName: 'Nazwa produktu',
      description: 'Opis',
      price: 'Cena (SEK)',
      category: 'Kategoria',
      selectCategory: 'Wybierz kategorię',
      tags: 'Tagi',
      tagsPlaceholder: 'Kliknij sugestie lub wpisz własne',
      suggestedTags: 'Sugerowane tagi:',
      vendor: 'Dostawca',
      save: 'Zapisz produkt',
      update: 'Aktualizuj',
      cancel: 'Anuluj',
      delete: 'Usuń',
      noProducts: 'Nie znaleziono produktów',
      loading: 'Ładowanie produktów...',
      deleteConfirm: 'Czy na pewno?',
      deleteDescription: 'Tej operacji nie można cofnąć. Produkt zostanie trwale usunięty.',
      productAdded: 'Produkt dodany!',
      productUpdated: 'Produkt zaktualizowany!',
      productDeleted: 'Produkt usunięty!',
      error: 'Coś poszło nie tak',
      inStock: 'W magazynie',
      outOfStock: 'Wyprzedane',
      moreProducts: 'więcej produktów',
      visibility: 'Widoczność',
      visibleInStore: 'Widoczny w sklepie',
      hiddenFromStore: 'Ukryty w sklepie',
      inventory: 'Magazyn',
      currentStock: 'Aktualny stan',
      allowOverselling: 'Pozwól na nadsprzedaż',
      oversellHint: 'Klienci mogą kupować nawet gdy stan wynosi 0',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      productType: '',
      tags: '',
      vendor: '4ThePeople',
      isVisible: true,
      inventory: 0,
      allowOverselling: false,
    });
    setSelectedProduct(null);
  };

  const handleEditClick = (product: ShopifyProduct) => {
    setSelectedProduct(product);

    const node = product.node as {
      title: string;
      description?: string;
      priceRange: { minVariantPrice: { amount: string } };
      productType?: string;
      tags?: string[];
      vendor?: string;
      availableForSale?: boolean;
      variants: { edges: Array<{ node: { id?: string } }> };
    };

    const firstVariantGid = node.variants?.edges?.[0]?.node?.id;
    const variantNumericId = gidToNumericId(firstVariantGid);

    setFormData({
      title: node.title,
      description: node.description || '',
      price: node.priceRange.minVariantPrice.amount,
      productType: node.productType || '',
      tags: node.tags?.join(', ') || '',
      vendor: node.vendor || '4ThePeople',
      isVisible: node.availableForSale !== false,
      inventory: 0,
      allowOverselling: false,
    });

    setIsEditDialogOpen(true);

    // Load current inventory/policy via Admin API (non-blocking, silent on failure)
    if (variantNumericId) {
      supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'getVariant',
          data: { variantId: Number(variantNumericId) },
        },
      }).then((res) => {
        if (res.error) {
          console.warn('Failed to load variant inventory:', res.error);
          return;
        }
        const variant = (res.data as { variant?: { inventory_quantity?: number; inventory_policy?: string } } | null)?.variant;
        if (variant) {
          setFormData((prev) => ({
            ...prev,
            inventory: typeof variant.inventory_quantity === 'number' ? variant.inventory_quantity : prev.inventory,
            allowOverselling: variant.inventory_policy === 'continue',
          }));
        }
      }).catch((err) => {
        console.warn('Failed to load variant inventory:', err);
      });
    }
  };

  const handleDeleteClick = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const addTag = (tag: string) => {
    const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (!currentTags.includes(tag)) {
      const newTags = [...currentTags, tag].join(', ');
      setFormData(prev => ({ ...prev, tags: newTags }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    const newTags = currentTags.filter(t => t !== tagToRemove).join(', ');
    setFormData(prev => ({ ...prev, tags: newTags }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'createProduct',
          data: {
            title: formData.title,
            body_html: formData.description,
            product_type: formData.productType,
            tags: formData.tags,
            vendor: formData.vendor,
            variants: [{
              price: formData.price,
              inventory_quantity: formData.inventory,
              inventory_management: 'shopify',
              inventory_policy: formData.allowOverselling ? 'continue' : 'deny',
            }],
          },
        },
      });

      if (response.error) throw response.error;

      toast.success(t.productAdded);
      resetForm();
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-products'] });
    } catch (error) {
      console.error('Failed to create product:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmitting(true);

    try {
      const productNumericId = gidToNumericId(selectedProduct.node.id);
      const firstVariantGid = selectedProduct.node.variants.edges[0]?.node.id;
      const variantNumericId = gidToNumericId(firstVariantGid);

      if (!productNumericId) throw new Error('Missing product id');
      if (!variantNumericId) throw new Error('Missing variant id');

      // If hidden, force not sellable.
      const targetQuantity = formData.isVisible ? formData.inventory : 0;
      const targetOversell = formData.isVisible ? formData.allowOverselling : false;

      const response = await supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'updateProduct',
          productId: productNumericId,
          data: {
            id: Number(productNumericId),
            title: formData.title,
            body_html: formData.description,
            product_type: formData.productType,
            tags: formData.tags,
            vendor: formData.vendor,
            variants: [
              {
                id: Number(variantNumericId),
                inventory_management: 'shopify',
                inventory_policy: targetOversell ? 'continue' : 'deny',
              },
            ],
          },
        },
      });

      if (response.error) throw response.error;

      const inventoryRes = await supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'updateInventory',
          data: {
            variantId: Number(variantNumericId),
            quantity: targetQuantity,
          },
        },
      });

      if (inventoryRes.error) throw inventoryRes.error;

      toast.success(t.productUpdated);
      resetForm();
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-products'] });
    } catch (error) {
      console.error('Failed to update product:', error);
      toast.error(t.error, {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    setIsSubmitting(true);

    try {
      const gid = selectedProduct.node.id;
      const numericId = gid.split('/').pop();

      const response = await supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'deleteProduct',
          productId: numericId,
        },
      });

      if (response.error) throw response.error;

      toast.success(t.productDeleted);
      setSelectedProduct(null);
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-products'] });
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (amount: string, currencyCode: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  // NOTE: Product form extracted to its own component to prevent remounting on every keystroke
  // (which caused focus loss + scroll-to-top inside the dialog).

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {t.addProduct}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                {t.addProduct}
              </DialogTitle>
            </DialogHeader>
            <AdminProductForm
              t={t}
              language={language}
              productCategories={productCategories}
              suggestedTags={suggestedTags}
              formData={formData}
              setFormData={setFormData}
              isEdit={false}
              isSubmitting={isSubmitting}
              onCancel={() => {
                resetForm();
                setIsAddDialogOpen(false);
              }}
              onSubmit={handleSubmit}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Product List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {productsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noProducts}</p>
        ) : (
          products.slice(0, 10).map((product: ShopifyProduct) => (
            <motion.div
              key={product.node.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
            >
              <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                {product.node.images.edges[0]?.node && (
                  <img
                    src={product.node.images.edges[0].node.url}
                    alt={product.node.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {!product.node.images.edges[0]?.node && (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{product.node.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(
                    product.node.priceRange.minVariantPrice.amount,
                    product.node.priceRange.minVariantPrice.currencyCode
                  )}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {product.node.variants.edges[0]?.node.availableForSale 
                  ? t.inStock
                  : t.outOfStock
                }
              </Badge>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEditClick(product)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteClick(product)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {products.length > 10 && (
        <p className="text-xs text-center text-muted-foreground">
          + {products.length - 10} {t.moreProducts}
        </p>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              {t.editProduct}
            </DialogTitle>
          </DialogHeader>
          <AdminProductForm
            t={t}
            language={language}
            productCategories={productCategories}
            suggestedTags={suggestedTags}
            formData={formData}
            setFormData={setFormData}
            isEdit
            isSubmitting={isSubmitting}
            onCancel={() => {
              resetForm();
              setIsEditDialogOpen(false);
            }}
            onSubmit={handleUpdate}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteDescription}
              {selectedProduct && (
                <span className="block mt-2 font-medium text-foreground">
                  {selectedProduct.node.title}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProduct(null)}>
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t.delete
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProductManager;
