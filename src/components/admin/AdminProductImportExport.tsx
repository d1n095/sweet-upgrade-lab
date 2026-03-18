import { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  XCircle, Loader2, Eye, RotateCcw, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { fetchDbProducts, createDbProduct, updateDbProduct, DbProduct } from '@/lib/products';
import { useQueryClient } from '@tanstack/react-query';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  data: {
    id?: string;
    title_sv: string;
    price: number;
    stock: number;
    is_visible: boolean;
    image_urls: string[];
    category?: string;
    description_sv?: string;
  } | null;
  errors: string[];
  status: 'valid' | 'error' | 'skipped' | 'success' | 'exists';
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: ParsedRow[];
}

const content = {
  sv: {
    exportBtn: 'Exportera CSV',
    importBtn: 'Importera CSV',
    exportSuccess: 'CSV exporterad!',
    importTitle: 'Importera produkter från CSV',
    preview: 'Förhandsgranska',
    dryRun: 'Torrkörning (testa utan att spara)',
    overwrite: 'Uppdatera befintliga produkter (matchat på ID)',
    startImport: 'Starta import',
    cancel: 'Avbryt',
    close: 'Stäng',
    row: 'Rad',
    name: 'Namn',
    price: 'Pris',
    stock: 'Lager',
    status: 'Status',
    valid: 'OK',
    error: 'Fel',
    skipped: 'Hoppade',
    exists: 'Finns redan',
    success: 'Importerad',
    created: 'Skapade',
    updated: 'Uppdaterade',
    failed: 'Misslyckade',
    importing: 'Importerar...',
    fileTooLarge: 'Filen är för stor (max 2MB)',
    invalidFormat: 'Ogiltigt filformat. Använd .csv',
    noValidRows: 'Inga giltiga rader hittades',
    missingName: 'Namn saknas',
    missingPrice: 'Pris saknas',
    invalidPrice: 'Ogiltigt pris',
    invalidStock: 'Ogiltigt lagervärde',
    duplicateName: 'Dubblettnamn',
    resultTitle: 'Importresultat',
    downloadErrors: 'Ladda ner felrapport',
    totalRows: 'Totalt rader',
    dryRunNote: 'Torrkörning — inga ändringar gjordes',
  },
  en: {
    exportBtn: 'Export CSV',
    importBtn: 'Import CSV',
    exportSuccess: 'CSV exported!',
    importTitle: 'Import products from CSV',
    preview: 'Preview',
    dryRun: 'Dry run (test without saving)',
    overwrite: 'Update existing products (matched by ID)',
    startImport: 'Start import',
    cancel: 'Cancel',
    close: 'Close',
    row: 'Row',
    name: 'Name',
    price: 'Price',
    stock: 'Stock',
    status: 'Status',
    valid: 'OK',
    error: 'Error',
    skipped: 'Skipped',
    exists: 'Exists',
    success: 'Imported',
    created: 'Created',
    updated: 'Updated',
    failed: 'Failed',
    importing: 'Importing...',
    fileTooLarge: 'File too large (max 2MB)',
    invalidFormat: 'Invalid file format. Use .csv',
    noValidRows: 'No valid rows found',
    missingName: 'Name is required',
    missingPrice: 'Price is required',
    invalidPrice: 'Invalid price',
    invalidStock: 'Invalid stock value',
    duplicateName: 'Duplicate name',
    resultTitle: 'Import result',
    downloadErrors: 'Download error report',
    totalRows: 'Total rows',
    dryRunNote: 'Dry run — no changes were made',
  },
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').trim();
    });
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
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const AdminProductImportExport = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = content[language as keyof typeof content] || content.en;

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isDryRun, setIsDryRun] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ── EXPORT ──
  const handleExport = useCallback(async () => {
    try {
      const products = await fetchDbProducts(true);
      const headers = ['id', 'name', 'description', 'price', 'stock', 'active', 'category', 'images', 'created_at'];
      const csvRows = [headers.join(',')];

      for (const p of products) {
        csvRows.push([
          escapeCSV(p.id),
          escapeCSV(p.title_sv),
          escapeCSV(p.description_sv || ''),
          p.price.toString(),
          p.stock.toString(),
          p.is_visible ? 'true' : 'false',
          escapeCSV(p.category || ''),
          escapeCSV((p.image_urls || []).join('|')),
          escapeCSV(p.created_at),
        ].join(','));
      }

      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.exportSuccess);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  }, [t]);

  // ── FILE SELECT ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error(t.fileTooLarge);
      return;
    }
    if (!file.name.endsWith('.csv')) {
      toast.error(t.invalidFormat);
      return;
    }

    const text = await file.text();
    const rawRows = parseCSV(text);
    if (rawRows.length === 0) {
      toast.error(t.noValidRows);
      return;
    }

    // Fetch existing products for duplicate checking
    const existing = await fetchDbProducts(true);
    const existingNames = new Set(existing.map(p => p.title_sv.toLowerCase()));
    const existingIds = new Set(existing.map(p => p.id));
    const seenNames = new Set<string>();

    const parsed: ParsedRow[] = rawRows.map((raw, idx) => {
      const errors: string[] = [];
      const name = (raw['name'] || raw['namn'] || raw['title'] || raw['title_sv'] || '').trim();
      const priceStr = (raw['price'] || raw['pris'] || '').trim();
      const stockStr = (raw['stock'] || raw['lager'] || '0').trim();
      const activeStr = (raw['active'] || raw['visible'] || raw['is_visible'] || 'true').trim().toLowerCase();
      const category = (raw['category'] || raw['kategori'] || '').trim();
      const description = (raw['description'] || raw['beskrivning'] || raw['description_sv'] || '').trim();
      const imagesStr = (raw['images'] || raw['bilder'] || raw['image_urls'] || '').trim();
      const id = (raw['id'] || '').trim();

      if (!name) errors.push(t.missingName);
      if (!priceStr) errors.push(t.missingPrice);

      const price = parseFloat(priceStr);
      if (priceStr && (isNaN(price) || price < 0)) errors.push(t.invalidPrice);

      const stock = parseInt(stockStr, 10);
      if (isNaN(stock) || stock < 0) errors.push(t.invalidStock);

      // Duplicate name check
      const nameLower = name.toLowerCase();
      if (nameLower && seenNames.has(nameLower)) {
        errors.push(t.duplicateName);
      }
      seenNames.add(nameLower);

      const isVisible = ['true', '1', 'yes', 'ja'].includes(activeStr);
      const imageUrls = imagesStr
        ? imagesStr.split('|').map(u => u.trim()).filter(Boolean)
        : [];

      // Check if ID exists for update
      let status: ParsedRow['status'] = errors.length > 0 ? 'error' : 'valid';
      if (id && existingIds.has(id) && !overwriteExisting) {
        status = 'exists';
      } else if (!id && existingNames.has(nameLower) && !overwriteExisting) {
        status = 'exists';
      }

      return {
        rowNumber: idx + 2, // +2 for header row + 0-index
        raw,
        data: errors.length === 0 ? {
          id: id || undefined,
          title_sv: name,
          price,
          stock: isNaN(stock) ? 0 : stock,
          is_visible: isVisible,
          image_urls: imageUrls,
          category: category || undefined,
          description_sv: description || undefined,
        } : null,
        errors,
        status,
      };
    });

    setParsedRows(parsed);
    setIsImportOpen(true);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [t, overwriteExisting]);

  // ── IMPORT ──
  const handleImport = useCallback(async () => {
    setIsImporting(true);
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, rows: [] };

    // Fetch existing for matching
    const existing = await fetchDbProducts(true);
    const existingById = new Map(existing.map(p => [p.id, p]));
    const existingByName = new Map(existing.map(p => [p.title_sv.toLowerCase(), p]));

    for (const row of parsedRows) {
      if (row.status === 'error') {
        result.failed++;
        result.rows.push(row);
        continue;
      }
      if (row.status === 'exists' && !overwriteExisting) {
        result.skipped++;
        result.rows.push({ ...row, status: 'skipped' });
        continue;
      }
      if (!row.data) {
        result.skipped++;
        result.rows.push({ ...row, status: 'skipped' });
        continue;
      }

      // Check if product exists
      const existingProduct = row.data.id
        ? existingById.get(row.data.id)
        : existingByName.get(row.data.title_sv.toLowerCase());

      if (isDryRun) {
        // Dry run — just mark result
        if (existingProduct && overwriteExisting) {
          result.updated++;
        } else if (existingProduct && !overwriteExisting) {
          result.skipped++;
          result.rows.push({ ...row, status: 'skipped' });
          continue;
        } else {
          result.created++;
        }
        result.rows.push({ ...row, status: 'success' });
        continue;
      }

      try {
        if (existingProduct && overwriteExisting) {
          await updateDbProduct(existingProduct.id, {
            title_sv: row.data.title_sv,
            price: row.data.price,
            stock: row.data.stock,
            is_visible: row.data.is_visible,
            image_urls: row.data.image_urls.length > 0 ? row.data.image_urls : null,
            category: row.data.category || null,
            description_sv: row.data.description_sv || null,
          });
          result.updated++;
          result.rows.push({ ...row, status: 'success' });
        } else if (!existingProduct) {
          await createDbProduct({
            title_sv: row.data.title_sv,
            title_en: null,
            description_sv: row.data.description_sv || null,
            description_en: null,
            price: row.data.price,
            original_price: null,
            category: row.data.category || null,
            tags: null,
            is_visible: row.data.is_visible,
            stock: row.data.stock,
            allow_overselling: false,
            image_urls: row.data.image_urls.length > 0 ? row.data.image_urls : null,
            badge: null,
            vendor: '4ThePeople',
            display_order: 0,
          });
          result.created++;
          result.rows.push({ ...row, status: 'success' });
        } else {
          result.skipped++;
          result.rows.push({ ...row, status: 'skipped' });
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
    }
  }, [parsedRows, isDryRun, overwriteExisting, queryClient]);

  // ── ERROR CSV DOWNLOAD ──
  const downloadErrorCSV = useCallback(() => {
    if (!importResult) return;
    const errorRows = importResult.rows.filter(r => r.status === 'error');
    if (errorRows.length === 0) return;

    const headers = ['row', 'errors', ...Object.keys(errorRows[0].raw)];
    const csvRows = [headers.join(',')];
    for (const row of errorRows) {
      csvRows.push([
        row.rowNumber.toString(),
        escapeCSV(row.errors.join('; ')),
        ...Object.values(row.raw).map(v => escapeCSV(v)),
      ].join(','));
    }

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult]);

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const errorCount = parsedRows.filter(r => r.status === 'error').length;
  const existsCount = parsedRows.filter(r => r.status === 'exists').length;

  return (
    <>
      {/* Export/Import Buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="w-4 h-4" />
          {t.exportBtn}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4" />
          {t.importBtn}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) setIsImportOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {t.importTitle}
            </DialogTitle>
          </DialogHeader>

          {/* Summary badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              {t.totalRows}: {parsedRows.length}
            </Badge>
            <Badge className="gap-1 bg-green-600">
              <CheckCircle2 className="w-3 h-3" />
              {t.valid}: {validCount}
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                {t.error}: {errorCount}
              </Badge>
            )}
            {existsCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                {t.exists}: {existsCount}
              </Badge>
            )}
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3 py-2 border-y border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                {t.dryRun}
              </Label>
              <Switch checked={isDryRun} onCheckedChange={setIsDryRun} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
                {t.overwrite}
              </Label>
              <Switch checked={overwriteExisting} onCheckedChange={setOverwriteExisting} />
            </div>
          </div>

          {/* Preview Table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t.row}</TableHead>
                  <TableHead>{t.name}</TableHead>
                  <TableHead className="w-24">{t.price}</TableHead>
                  <TableHead className="w-20">{t.stock}</TableHead>
                  <TableHead className="w-28">{t.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((row, idx) => (
                  <TableRow key={idx} className={row.status === 'error' ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[200px]">
                      {row.data?.title_sv || row.raw['name'] || row.raw['namn'] || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.data?.price != null ? `${row.data.price} kr` : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{row.data?.stock ?? '—'}</TableCell>
                    <TableCell>
                      {row.status === 'valid' && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-400 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {t.valid}
                        </Badge>
                      )}
                      {row.status === 'error' && (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="destructive" className="text-xs gap-1 w-fit">
                            <XCircle className="w-3 h-3" /> {t.error}
                          </Badge>
                          {row.errors.map((err, i) => (
                            <span key={i} className="text-[10px] text-destructive">{err}</span>
                          ))}
                        </div>
                      )}
                      {row.status === 'exists' && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <AlertTriangle className="w-3 h-3" /> {t.exists}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={isImporting}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || validCount === 0}
              className="gap-2"
            >
              {isImporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t.importing}</>
              ) : (
                <><Upload className="w-4 h-4" /> {isDryRun ? t.preview : t.startImport}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={isResultOpen} onOpenChange={(open) => { if (!open) setIsResultOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {t.resultTitle}
            </DialogTitle>
          </DialogHeader>

          {isDryRun && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Eye className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-300">{t.dryRunNote}</p>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                  <p className="text-xs text-muted-foreground">{t.created}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                  <p className="text-xs text-muted-foreground">{t.updated}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                  <p className="text-2xl font-bold text-orange-600">{importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">{t.skipped}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                  <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                  <p className="text-xs text-muted-foreground">{t.failed}</p>
                </div>
              </div>

              {importResult.failed > 0 && (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadErrorCSV}>
                  <Download className="w-4 h-4" />
                  {t.downloadErrors}
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsResultOpen(false)}>{t.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminProductImportExport;
