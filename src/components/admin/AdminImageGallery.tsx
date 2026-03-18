import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Copy, Trash2, Loader2, Image, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StorageImage {
  name: string;
  url: string;
  created_at: string;
}

const AdminImageGallery = () => {
  const [images, setImages] = useState<StorageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StorageImage | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const fetchImages = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from('product-images').list('', {
      limit: 500,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (!error && data) {
      const imgs: StorageImage[] = data
        .filter(f => !f.id?.startsWith('.') && f.name !== '.emptyFolderPlaceholder')
        .map(f => ({
          name: f.name,
          url: supabase.storage.from('product-images').getPublicUrl(f.name).data.publicUrl,
          created_at: f.created_at || '',
        }));
      setImages(imgs);
    }
    setLoading(false);
  };

  useEffect(() => { fetchImages(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return images;
    const q = search.toLowerCase();
    return images.filter(i => i.name.toLowerCase().includes(q));
  }, [images, search]);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL kopierad!');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.storage.from('product-images').remove([deleteTarget.name]);
    if (error) { toast.error('Kunde inte ta bort'); return; }
    toast.success('Bild borttagen');
    setImages(prev => prev.filter(i => i.name !== deleteTarget.name));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Image className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Bildgalleri</h3>
            <p className="text-sm text-muted-foreground">Alla uppladdade produktbilder</p>
          </div>
        </div>
        <Badge variant="secondary">{images.length} bilder</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök bildnamn..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Inga bilder matchar sökningen' : 'Inga bilder uppladdade'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {filtered.map((img, idx) => (
            <motion.div
              key={img.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.02 }}
              className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                selectedUrl === img.url ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'
              }`}
              onClick={() => setSelectedUrl(selectedUrl === img.url ? null : img.url)}
            >
              <img
                src={img.url}
                alt={img.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={e => { e.stopPropagation(); handleCopy(img.url); }}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                  title="Kopiera URL"
                >
                  <Copy className="w-3.5 h-3.5 text-foreground" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteTarget(img); }}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  title="Ta bort"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Selected image detail */}
      {selectedUrl && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
        >
          <img src={selectedUrl} alt="" className="w-16 h-16 rounded-md object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{selectedUrl}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => handleCopy(selectedUrl)} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Kopiera URL
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={selectedUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Öppna
            </a>
          </Button>
        </motion.div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort bild?</AlertDialogTitle>
            <AlertDialogDescription>
              Bilden tas bort permanent från lagring. Produkter som använder den visar en trasig bild.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminImageGallery;
