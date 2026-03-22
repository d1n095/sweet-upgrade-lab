import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Search, RefreshCw, Download, ChevronLeft, ChevronRight, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type TableName = 'products' | 'orders' | 'profiles' | 'reviews' | 'analytics_events';

interface TableConfig {
  name: TableName;
  label: string;
  columns: { key: string; label: string; visible: boolean; sortable: boolean }[];
  searchFields: string[];
}

const tables: TableConfig[] = [
  {
    name: 'products',
    label: 'Produkter',
    columns: [
      { key: 'title_sv', label: 'Namn', visible: true, sortable: true },
      { key: 'status', label: 'Status', visible: true, sortable: true },
      { key: 'price', label: 'Pris', visible: true, sortable: true },
      { key: 'stock', label: 'Lager', visible: true, sortable: true },
      { key: 'category', label: 'Kategori', visible: true, sortable: true },
      { key: 'updated_at', label: 'Uppdaterad', visible: true, sortable: true },
      { key: 'is_visible', label: 'Synlig', visible: false, sortable: false },
      { key: 'badge', label: 'Badge', visible: false, sortable: false },
    ],
    searchFields: ['title_sv', 'title_en', 'category'],
  },
  {
    name: 'orders',
    label: 'Ordrar',
    columns: [
      { key: 'order_number', label: 'Order #', visible: true, sortable: true },
      { key: 'order_email', label: 'Email', visible: true, sortable: true },
      { key: 'status', label: 'Status', visible: true, sortable: true },
      { key: 'payment_status', label: 'Betalning', visible: true, sortable: true },
      { key: 'total_amount', label: 'Belopp', visible: true, sortable: true },
      { key: 'created_at', label: 'Skapad', visible: true, sortable: true },
      { key: 'fulfillment_status', label: 'Fulfillment', visible: false, sortable: true },
    ],
    searchFields: ['order_email', 'order_number'],
  },
  {
    name: 'profiles',
    label: 'Användare',
    columns: [
      { key: 'full_name', label: 'Namn', visible: true, sortable: true },
      { key: 'username', label: 'Användarnamn', visible: true, sortable: true },
      { key: 'is_member', label: 'Medlem', visible: true, sortable: true },
      { key: 'level', label: 'Nivå', visible: true, sortable: true },
      { key: 'xp', label: 'XP', visible: true, sortable: true },
      { key: 'city', label: 'Stad', visible: true, sortable: true },
      { key: 'created_at', label: 'Skapad', visible: true, sortable: true },
    ],
    searchFields: ['full_name', 'username', 'city'],
  },
  {
    name: 'reviews',
    label: 'Recensioner',
    columns: [
      { key: 'product_title', label: 'Produkt', visible: true, sortable: true },
      { key: 'rating', label: 'Betyg', visible: true, sortable: true },
      { key: 'comment', label: 'Kommentar', visible: true, sortable: false },
      { key: 'is_approved', label: 'Godkänd', visible: true, sortable: true },
      { key: 'is_verified_purchase', label: 'Verifierat', visible: true, sortable: true },
      { key: 'created_at', label: 'Skapad', visible: true, sortable: true },
    ],
    searchFields: ['product_title', 'comment'],
  },
];

const PAGE_SIZE = 25;

const fmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);

const AdminDatabase = () => {
  const [activeTable, setActiveTable] = useState<TableName>('products');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sortCol, setSortCol] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({});

  const config = useMemo(() => tables.find(t => t.name === activeTable)!, [activeTable]);

  // Init visible columns
  useEffect(() => {
    const cols: Record<string, boolean> = {};
    config.columns.forEach(c => { cols[c.key] = c.visible; });
    setVisibleCols(cols);
    setSortCol('created_at');
    setSortAsc(false);
    setPage(0);
    setSearch('');
  }, [activeTable]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const selectCols = ['id', ...config.columns.map(c => c.key)].join(',');
      let query = supabase
        .from(activeTable)
        .select(selectCols, { count: 'exact' });

      if (activeTable === 'orders') {
        query = query.is('deleted_at', null);
      }

      query = query.order(sortCol, { ascending: sortAsc })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data: rows, count, error } = await query;
      if (error) throw error;
      setData(rows || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.error('DB fetch error:', e);
      toast.error('Kunde inte ladda data');
    } finally {
      setLoading(false);
    }
  }, [activeTable, sortCol, sortAsc, page, config]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      config.searchFields.some(f => String(row[f] || '').toLowerCase().includes(q))
    );
  }, [data, search, config]);

  const displayCols = config.columns.filter(c => visibleCols[c.key]);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(key);
      setSortAsc(true);
    }
    setPage(0);
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    const headers = displayCols.map(c => c.label);
    const rows = filtered.map(row => displayCols.map(c => String(row[c.key] ?? '')));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTable}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exporterad');
  };

  const renderCell = (row: any, col: { key: string }) => {
    const val = row[col.key];
    if (val === null || val === undefined) return <span className="text-muted-foreground">–</span>;
    if (typeof val === 'boolean') {
      return <Badge variant={val ? 'default' : 'outline'} className="text-[10px]">{val ? 'Ja' : 'Nej'}</Badge>;
    }
    if (col.key === 'status' || col.key === 'payment_status' || col.key === 'fulfillment_status') {
      return <Badge variant="outline" className="text-[10px]">{String(val)}</Badge>;
    }
    if (col.key === 'total_amount' || col.key === 'price') {
      return <span className="font-mono text-sm">{fmt(Number(val))}</span>;
    }
    if (col.key === 'rating') {
      return <span className="font-mono">{'⭐'.repeat(Math.min(Number(val), 5))}</span>;
    }
    if (col.key.includes('_at') || col.key.includes('created')) {
      return <span className="text-xs text-muted-foreground">{new Date(val).toLocaleDateString('sv-SE')}</span>;
    }
    if (col.key === 'comment') {
      return <span className="text-sm truncate max-w-[200px] block">{String(val).slice(0, 80)}</span>;
    }
    return <span className="text-sm">{String(val)}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Databas</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tables.map(t => (
            <Button
              key={t.name}
              variant={activeTable === t.name ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setActiveTable(t.name)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Search + actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`Sök i ${config.label.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchData}>
            <RefreshCw className="w-3.5 h-3.5" /> Ladda om
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Column toggles */}
      <div className="flex flex-wrap gap-1">
        {config.columns.map(c => (
          <Button
            key={c.key}
            variant={visibleCols[c.key] ? 'default' : 'outline'}
            size="sm"
            className="text-[10px] h-6 px-2"
            onClick={() => setVisibleCols(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayCols.map(col => (
                      <TableHead
                        key={col.key}
                        className={col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortCol === col.key && (
                            <span className="text-[10px]">{sortAsc ? '↑' : '↓'}</span>
                          )}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={displayCols.length} className="text-center text-muted-foreground py-12">
                        Ingen data hittades
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(row => (
                      <TableRow key={row.id} className="hover:bg-muted/50">
                        {displayCols.map(col => (
                          <TableCell key={col.key} className="py-2">
                            {renderCell(row, col)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Visar {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} av {totalCount}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs px-2">
            {page + 1} / {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminDatabase;
