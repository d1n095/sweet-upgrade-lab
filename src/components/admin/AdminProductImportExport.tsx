import { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  XCircle, Loader2, Eye, RotateCcw, X, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { fetchDbProducts, createDbProduct, updateDbProduct, DbProduct } from '@/lib/products';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { logActivity } from '@/utils/activityLogger';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  data: Record<string, any> | null;
  errors: string[];
  status: 'valid' | 'error' | 'skipped' | 'success' | 'exists';
  dataType: 'product' | 'ingredient' | 'recipe_template';
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: ParsedRow[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => { row[header] = (values[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// ── Detect data type from CSV headers ──
function detectDataType(headers: string[]): 'product' | 'ingredient' | 'recipe_template' | 'mixed' {
  const h = headers.map(x => x.toLowerCase());
  // Ingredients have name_sv + category (no price)
  if ((h.includes('name_sv') || h.includes('namn')) && (h.includes('category') || h.includes('kategori')) && !h.includes('price') && !h.includes('pris')) {
    // Could be ingredient or recipe template
    if (h.includes('slot_type') || h.includes('slots') || h.includes('description_sv')) {
      // If it has slot_type it's a recipe template
      if (h.includes('slot_type')) return 'recipe_template';
    }
    return 'ingredient';
  }
  // Recipe templates have name_sv + slots or description
  if ((h.includes('name_sv') || h.includes('template_name')) && (h.includes('slots') || h.includes('description_sv'))) {
    return 'recipe_template';
  }
  return 'product';
}

const AdminProductImportExport = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sv = language === 'sv';

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isDryRun, setIsDryRun] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [detectedType, setDetectedType] = useState<string>('product');

  // ── EXPORT PRODUCTS ──
  const handleExportProducts = useCallback(async () => {
    try {
      const products = await fetchDbProducts(true);
      const headers = ['id', 'name', 'description', 'price', 'stock', 'active', 'category', 'images', 'ingredients', 'certifications', 'recipe', 'created_at'];
      const csvRows = [headers.join(',')];
      for (const p of products) {
        csvRows.push([
          escapeCSV(p.id), escapeCSV(p.title_sv), escapeCSV(p.description_sv || ''),
          p.price.toString(), p.stock.toString(), p.is_visible ? 'true' : 'false',
          escapeCSV(p.category || ''), escapeCSV((p.image_urls || []).join('|')),
          escapeCSV(p.ingredients_sv || ''), escapeCSV((p.certifications || []).join(',')),
          escapeCSV(p.recipe_sv || ''), escapeCSV(p.created_at),
        ].join(','));
      }
      downloadCSV(csvRows, `products-${dateStr()}.csv`);
      toast.success(sv ? 'Produkter exporterade!' : 'Products exported!');
      logActivity({ log_type: 'info', category: 'product', message: `Produkter exporterade (${products.length} st)` });
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
  }, [sv]);

  // ── EXPORT INGREDIENTS ──
  const handleExportIngredients = useCallback(async () => {
    try {
      const { data } = await supabase.from('recipe_ingredients').select('*').order('category').order('display_order');
      if (!data) { toast.error('Inga ingredienser'); return; }
      const headers = ['id', 'name_sv', 'name_en', 'category', 'description_sv', 'description_en', 'is_active'];
      const csvRows = [headers.join(',')];
      for (const i of data) {
        csvRows.push([
          escapeCSV(i.id), escapeCSV(i.name_sv), escapeCSV(i.name_en || ''),
          escapeCSV(i.category), escapeCSV(i.description_sv || ''), escapeCSV(i.description_en || ''),
          i.is_active ? 'true' : 'false',
        ].join(','));
      }
      downloadCSV(csvRows, `ingredients-${dateStr()}.csv`);
      toast.success(sv ? 'Ingredienser exporterade!' : 'Ingredients exported!');
      logActivity({ log_type: 'info', category: 'product', message: `Ingredienser exporterade (${data.length} st)` });
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
  }, [sv]);

  // ── EXPORT RECIPE TEMPLATES ──
  const handleExportRecipeTemplates = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        supabase.from('recipe_templates').select('*').order('display_order'),
        supabase.from('recipe_template_slots').select('*').order('display_order'),
      ]);
      if (!tRes.data) { toast.error('Inga receptmallar'); return; }
      const headers = ['id', 'name_sv', 'name_en', 'description_sv', 'is_active', 'slots_count'];
      const csvRows = [headers.join(',')];
      for (const t of tRes.data) {
        const slotCount = (sRes.data || []).filter((s: any) => s.template_id === t.id).length;
        csvRows.push([
          escapeCSV(t.id), escapeCSV(t.name_sv), escapeCSV(t.name_en || ''),
          escapeCSV(t.description_sv || ''), t.is_active ? 'true' : 'false', slotCount.toString(),
        ].join(','));
      }
      downloadCSV(csvRows, `recipe-templates-${dateStr()}.csv`);
      toast.success(sv ? 'Receptmallar exporterade!' : 'Recipe templates exported!');
      logActivity({ log_type: 'info', category: 'product', message: `Receptmallar exporterade (${tRes.data.length} st)` });
    } catch (err: any) { toast.error(err?.message || 'Export failed'); }
  }, [sv]);

  // ── EXPORT ALL ──
  const handleExportAll = useCallback(async () => {
    await handleExportProducts();
    await handleExportIngredients();
    await handleExportRecipeTemplates();
  }, [handleExportProducts, handleExportIngredients, handleExportRecipeTemplates]);

  // ── DOWNLOAD TEMPLATE ──
  const handleDownloadTemplate = useCallback(() => {
    const headers = ['name', 'description', 'price', 'stock', 'active', 'category', 'images', 'ingredients', 'certifications', 'recipe'];
    const exampleRow = [
      'Naturlig Deodorant', 'Aluminiumfri deodorant med naturlig doft', '149', '50', 'true',
      'Kroppsvård', 'https://example.com/img1.jpg|https://example.com/img2.jpg',
      'Kokosolja, Sheasmör, Bivax', 'Cruelty-Free, Vegan', '5 droppar per skopa'
    ].map(v => escapeCSV(v));
    downloadCSV([headers.join(','), exampleRow.join(',')], `product-import-template.csv`);
    toast.success(sv ? 'Mall nedladdad!' : 'Template downloaded!');
  }, [sv]);

  // ── FILE SELECT (auto-detect type) ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error(sv ? 'Filen är för stor (max 2MB)' : 'File too large'); return; }
    if (!file.name.endsWith('.csv')) { toast.error(sv ? 'Använd .csv' : 'Use .csv'); return; }

    const text = await file.text();
    const rawRows = parseCSV(text);
    if (rawRows.length === 0) { toast.error(sv ? 'Inga rader' : 'No rows'); return; }

    const headers = Object.keys(rawRows[0]);
    const type = detectDataType(headers);
    setDetectedType(type);

    if (type === 'ingredient') {
      const parsed = parseIngredientRows(rawRows);
      setParsedRows(parsed);
    } else if (type === 'recipe_template') {
      const parsed = parseRecipeRows(rawRows);
      setParsedRows(parsed);
    } else {
      const parsed = await parseProductRows(rawRows);
      setParsedRows(parsed);
    }

    setIsImportOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [sv, overwriteExisting]);

  // ── Parse ingredient rows ──
  function parseIngredientRows(rawRows: Record<string, string>[]): ParsedRow[] {
    return rawRows.map((raw, idx) => {
      const errors: string[] = [];
      const name_sv = (raw['name_sv'] || raw['namn'] || '').trim();
      const category = (raw['category'] || raw['kategori'] || 'Övrigt').trim();
      if (!name_sv) errors.push('Namn saknas');
      return {
        rowNumber: idx + 2, raw,
        data: errors.length === 0 ? {
          name_sv, name_en: (raw['name_en'] || '').trim() || null, category,
          description_sv: (raw['description_sv'] || '').trim() || null,
          description_en: (raw['description_en'] || '').trim() || null,
          is_active: !['false', '0', 'no', 'nej'].includes((raw['is_active'] || 'true').toLowerCase()),
        } : null,
        errors, status: errors.length > 0 ? 'error' : 'valid', dataType: 'ingredient',
      };
    });
  }

  // ── Parse recipe template rows ──
  function parseRecipeRows(rawRows: Record<string, string>[]): ParsedRow[] {
    return rawRows.map((raw, idx) => {
      const errors: string[] = [];
      const name_sv = (raw['name_sv'] || raw['template_name'] || '').trim();
      if (!name_sv) errors.push('Namn saknas');
      return {
        rowNumber: idx + 2, raw,
        data: errors.length === 0 ? {
          name_sv, name_en: (raw['name_en'] || '').trim() || null,
          description_sv: (raw['description_sv'] || '').trim() || null,
          is_active: !['false', '0', 'no', 'nej'].includes((raw['is_active'] || 'true').toLowerCase()),
        } : null,
        errors, status: errors.length > 0 ? 'error' : 'valid', dataType: 'recipe_template',
      };
    });
  }

  // ── Parse product rows ──
  async function parseProductRows(rawRows: Record<string, string>[]): Promise<ParsedRow[]> {
    const existing = await fetchDbProducts(true);
    const existingNames = new Set(existing.map(p => p.title_sv.toLowerCase()));
    const existingIds = new Set(existing.map(p => p.id));
    const seenNames = new Set<string>();

    return rawRows.map((raw, idx) => {
      const errors: string[] = [];
      const name = (raw['name'] || raw['namn'] || raw['title'] || raw['title_sv'] || '').trim();
      const priceStr = (raw['price'] || raw['pris'] || '').trim();
      const stockStr = (raw['stock'] || raw['lager'] || '0').trim();
      const activeStr = (raw['active'] || raw['visible'] || raw['is_visible'] || 'true').trim().toLowerCase();
      const category = (raw['category'] || raw['kategori'] || '').trim();
      const description = (raw['description'] || raw['beskrivning'] || raw['description_sv'] || '').trim();
      const imagesStr = (raw['images'] || raw['bilder'] || raw['image_urls'] || '').trim();
      const ingredientsStr = (raw['ingredients'] || raw['ingredienser'] || '').trim();
      const certsStr = (raw['certifications'] || raw['certifieringar'] || '').trim();
      const recipeStr = (raw['recipe'] || raw['recept'] || '').trim();
      const id = (raw['id'] || '').trim();

      if (!name) errors.push('Namn saknas');
      if (!priceStr) errors.push('Pris saknas');
      const price = parseFloat(priceStr);
      if (priceStr && (isNaN(price) || price < 0)) errors.push('Ogiltigt pris');
      const stock = parseInt(stockStr, 10);
      if (isNaN(stock) || stock < 0) errors.push('Ogiltigt lager');
      const nameLower = name.toLowerCase();
      if (nameLower && seenNames.has(nameLower)) errors.push('Dubblettnamn');
      seenNames.add(nameLower);

      let status: ParsedRow['status'] = errors.length > 0 ? 'error' : 'valid';
      if (id && existingIds.has(id) && !overwriteExisting) status = 'exists';
      else if (!id && existingNames.has(nameLower) && !overwriteExisting) status = 'exists';

      return {
        rowNumber: idx + 2, raw,
        data: errors.length === 0 ? {
          id: id || undefined, title_sv: name, price, stock: isNaN(stock) ? 0 : stock,
          is_visible: ['true', '1', 'yes', 'ja'].includes(activeStr),
          image_urls: imagesStr ? imagesStr.split('|').map(u => u.trim()).filter(Boolean) : [],
          category: category || undefined, description_sv: description || undefined,
          ingredients_sv: ingredientsStr || undefined,
          certifications: certsStr ? certsStr.split(',').map(c => c.trim()).filter(Boolean) : undefined,
          recipe_sv: recipeStr || undefined,
        } : null,
        errors, status, dataType: 'product' as const,
      };
    });
  }

  // ── IMPORT ──
  const handleImport = useCallback(async () => {
    setIsImporting(true);
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, rows: [] };

    for (const row of parsedRows) {
      if (row.status === 'error') { result.failed++; result.rows.push(row); continue; }
      if (row.status === 'exists' && !overwriteExisting) { result.skipped++; result.rows.push({ ...row, status: 'skipped' }); continue; }
      if (!row.data) { result.skipped++; result.rows.push({ ...row, status: 'skipped' }); continue; }

      if (isDryRun) { result.created++; result.rows.push({ ...row, status: 'success' }); continue; }

      try {
        if (row.dataType === 'ingredient') {
          await supabase.from('recipe_ingredients').insert({
            name_sv: row.data.name_sv, name_en: row.data.name_en, category: row.data.category,
            description_sv: row.data.description_sv, description_en: row.data.description_en,
            is_active: row.data.is_active, display_order: result.created,
          });
          result.created++;
          result.rows.push({ ...row, status: 'success' });
        } else if (row.dataType === 'recipe_template') {
          await supabase.from('recipe_templates').insert({
            name_sv: row.data.name_sv, name_en: row.data.name_en,
            description_sv: row.data.description_sv, is_active: row.data.is_active,
            display_order: result.created,
          });
          result.created++;
          result.rows.push({ ...row, status: 'success' });
        } else {
          // Product import (existing logic)
          const existing = await fetchDbProducts(true);
          const existingById = new Map(existing.map(p => [p.id, p]));
          const existingByName = new Map(existing.map(p => [p.title_sv.toLowerCase(), p]));
          const existingProduct = row.data.id ? existingById.get(row.data.id) : existingByName.get(row.data.title_sv.toLowerCase());

          if (existingProduct && overwriteExisting) {
            await updateDbProduct(existingProduct.id, {
              title_sv: row.data.title_sv, price: row.data.price, stock: row.data.stock,
              is_visible: row.data.is_visible,
              image_urls: row.data.image_urls?.length > 0 ? row.data.image_urls : null,
              category: row.data.category || null, description_sv: row.data.description_sv || null,
              ingredients_sv: row.data.ingredients_sv || null,
              certifications: row.data.certifications || null,
              recipe_sv: row.data.recipe_sv || null,
            });
            result.updated++;
            result.rows.push({ ...row, status: 'success' });
          } else if (!existingProduct) {
            await createDbProduct({
              title_sv: row.data.title_sv, title_en: null, description_sv: row.data.description_sv || null,
              description_en: null, price: row.data.price, original_price: null,
              category: row.data.category || null, tags: null, is_visible: row.data.is_visible,
              stock: row.data.stock, allow_overselling: false,
              image_urls: row.data.image_urls?.length > 0 ? row.data.image_urls : null,
              badge: null, vendor: '4ThePeople', display_order: 0,
              ingredients_sv: row.data.ingredients_sv || null,
              certifications: row.data.certifications || null,
              recipe_sv: row.data.recipe_sv || null,
            });
            result.created++;
            result.rows.push({ ...row, status: 'success' });
          } else {
            result.skipped++;
            result.rows.push({ ...row, status: 'skipped' });
          }
        }
      } catch (err: any) {
        result.failed++;
        result.rows.push({ ...row, status: 'error', errors: [...row.errors, err?.message || 'Unknown error'] });
      }
    }

    setImportResult(result);
    setIsImportOpen(false);
    setIsResultOpen(true);
    setIsImporting(false);

    if (!isDryRun) {
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
      const typeLabel = detectedType === 'ingredient' ? 'ingredienser' : detectedType === 'recipe_template' ? 'receptmallar' : 'produkter';
      logActivity({
        log_type: 'success', category: 'product',
        message: `Import av ${typeLabel}: ${result.created} skapade, ${result.updated} uppdaterade, ${result.failed} misslyckade`,
        details: { type: detectedType, created: result.created, updated: result.updated, failed: result.failed },
      });
    }
  }, [parsedRows, isDryRun, overwriteExisting, queryClient, detectedType]);

  const downloadErrorCSV = useCallback(() => {
    if (!importResult) return;
    const errorRows = importResult.rows.filter(r => r.status === 'error');
    if (errorRows.length === 0) return;
    const headers = ['row', 'errors', ...Object.keys(errorRows[0].raw)];
    const csvRows = [headers.join(',')];
    for (const row of errorRows) {
      csvRows.push([row.rowNumber.toString(), escapeCSV(row.errors.join('; ')), ...Object.values(row.raw).map(v => escapeCSV(v))].join(','));
    }
    downloadCSV(csvRows, `import-errors-${dateStr()}.csv`);
  }, [importResult]);

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const errorCount = parsedRows.filter(r => r.status === 'error').length;

  const typeLabels: Record<string, string> = {
    product: sv ? 'Produkter' : 'Products',
    ingredient: sv ? 'Ingredienser' : 'Ingredients',
    recipe_template: sv ? 'Receptmallar' : 'Recipe Templates',
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              {sv ? 'Exportera' : 'Export'}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportProducts}>
              📦 {sv ? 'Produkter (CSV)' : 'Products (CSV)'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportIngredients}>
              🧪 {sv ? 'Ingredienser (CSV)' : 'Ingredients (CSV)'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportRecipeTemplates}>
              👨‍🍳 {sv ? 'Receptmallar (CSV)' : 'Recipe Templates (CSV)'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExportAll}>
              📁 {sv ? 'Exportera allt' : 'Export all'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDownloadTemplate}>
              📋 {sv ? 'Ladda ner importmall' : 'Download import template'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Import */}
        <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4" />
          {sv ? 'Importera CSV' : 'Import CSV'}
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) setIsImportOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {sv ? 'Importera' : 'Import'} — {typeLabels[detectedType] || detectedType}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              {sv ? 'Auto-identifierat' : 'Auto-detected'}: {typeLabels[detectedType]}
            </Badge>
            <Badge variant="outline" className="gap-1">
              {sv ? 'Totalt' : 'Total'}: {parsedRows.length}
            </Badge>
            <Badge className="gap-1 bg-primary/80">
              <CheckCircle2 className="w-3 h-3" /> OK: {validCount}
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" /> {sv ? 'Fel' : 'Error'}: {errorCount}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-3 py-2 border-y border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                {sv ? 'Torrkörning (testa utan att spara)' : 'Dry run'}
              </Label>
              <Switch checked={isDryRun} onCheckedChange={setIsDryRun} />
            </div>
            {detectedType === 'product' && (
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  {sv ? 'Uppdatera befintliga (matchat på ID)' : 'Update existing'}
                </Label>
                <Switch checked={overwriteExisting} onCheckedChange={setOverwriteExisting} />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{sv ? 'Rad' : 'Row'}</TableHead>
                  <TableHead>{sv ? 'Namn' : 'Name'}</TableHead>
                  {detectedType === 'product' && <TableHead className="w-24">{sv ? 'Pris' : 'Price'}</TableHead>}
                  {detectedType === 'ingredient' && <TableHead className="w-28">{sv ? 'Kategori' : 'Category'}</TableHead>}
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((row, idx) => (
                  <TableRow key={idx} className={row.status === 'error' ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[200px]">
                      {row.data?.title_sv || row.data?.name_sv || row.raw['name'] || row.raw['name_sv'] || '—'}
                    </TableCell>
                    {detectedType === 'product' && (
                      <TableCell className="text-sm">{row.data?.price != null ? `${row.data.price} kr` : '—'}</TableCell>
                    )}
                    {detectedType === 'ingredient' && (
                      <TableCell className="text-xs">{row.data?.category || row.raw['category'] || '—'}</TableCell>
                    )}
                    <TableCell>
                      {row.status === 'valid' && <Badge variant="outline" className="text-xs gap-1"><CheckCircle2 className="w-3 h-3" /> OK</Badge>}
                      {row.status === 'error' && (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="destructive" className="text-xs gap-1 w-fit"><XCircle className="w-3 h-3" /> Fel</Badge>
                          {row.errors.map((err, i) => <span key={i} className="text-[10px] text-destructive">{err}</span>)}
                        </div>
                      )}
                      {row.status === 'exists' && <Badge variant="secondary" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" /> Finns</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={isImporting}>{sv ? 'Avbryt' : 'Cancel'}</Button>
            <Button onClick={handleImport} disabled={isImporting || validCount === 0} className="gap-2">
              {isImporting ? <><Loader2 className="w-4 h-4 animate-spin" /> {sv ? 'Importerar...' : 'Importing...'}</> : <><Upload className="w-4 h-4" /> {isDryRun ? (sv ? 'Förhandsgranska' : 'Preview') : (sv ? 'Starta import' : 'Start import')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={isResultOpen} onOpenChange={(open) => { if (!open) setIsResultOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {sv ? 'Importresultat' : 'Import result'} — {typeLabels[detectedType]}
            </DialogTitle>
          </DialogHeader>
          {isDryRun && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Eye className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm">{sv ? 'Torrkörning — inga ändringar gjordes' : 'Dry run — no changes'}</p>
            </div>
          )}
          {importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { n: importResult.created, l: sv ? 'Skapade' : 'Created', c: 'bg-primary/10 border-primary/20 text-primary' },
                  { n: importResult.updated, l: sv ? 'Uppdaterade' : 'Updated', c: 'bg-accent/10 border-accent/20 text-accent-foreground' },
                  { n: importResult.skipped, l: sv ? 'Hoppade' : 'Skipped', c: 'bg-muted border-border text-muted-foreground' },
                  { n: importResult.failed, l: sv ? 'Misslyckade' : 'Failed', c: 'bg-destructive/10 border-destructive/20 text-destructive' },
                ].map(({ n, l, c }) => (
                  <div key={l} className={`p-3 rounded-lg border text-center ${c}`}>
                    <p className="text-2xl font-bold">{n}</p>
                    <p className="text-xs">{l}</p>
                  </div>
                ))}
              </div>
              {importResult.failed > 0 && (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadErrorCSV}>
                  <Download className="w-4 h-4" /> {sv ? 'Ladda ner felrapport' : 'Download errors'}
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsResultOpen(false)}>{sv ? 'Stäng' : 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

function downloadCSV(rows: string[], filename: string) {
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function dateStr() { return new Date().toISOString().slice(0, 10); }

export default AdminProductImportExport;
