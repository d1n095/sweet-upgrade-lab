import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, CheckCircle2, Clock, Package, Headphones, RotateCcw,
  ShieldAlert, Bug, Wrench, FileText, AlertTriangle, Bot, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const TYPE_META: Record<string, { label: string; icon: typeof Package; color: string }> = {
  pack_order: { label: 'Packning', icon: Package, color: 'text-orange-600 bg-orange-600/10' },
  packing: { label: 'Packning', icon: Package, color: 'text-orange-600 bg-orange-600/10' },
  shipping: { label: 'Frakt', icon: Package, color: 'text-blue-600 bg-blue-600/10' },
  support_case: { label: 'Support', icon: Headphones, color: 'text-cyan-600 bg-cyan-600/10' },
  support: { label: 'Support', icon: Headphones, color: 'text-cyan-600 bg-cyan-600/10' },
  refund_request: { label: 'Återbetalning', icon: RotateCcw, color: 'text-purple-600 bg-purple-600/10' },
  refund: { label: 'Återbetalning', icon: RotateCcw, color: 'text-purple-600 bg-purple-600/10' },
  incident: { label: 'Incident', icon: ShieldAlert, color: 'text-destructive bg-destructive/10' },
  bug: { label: 'Bugg', icon: Bug, color: 'text-red-600 bg-red-600/10' },
  manual: { label: 'Manuell', icon: Wrench, color: 'text-muted-foreground bg-secondary' },
  general: { label: 'Allmänt', icon: FileText, color: 'text-muted-foreground bg-secondary' },
  insight: { label: 'AI Insight', icon: Bot, color: 'text-purple-600 bg-purple-600/10' },
};

const REVIEW_STATUS_COLORS: Record<string, string> = {
  verified: 'bg-green-100 text-green-700 border-green-200',
  needs_review: 'bg-amber-100 text-amber-700 border-amber-200',
  incomplete: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-secondary text-muted-foreground border-border',
};

const AdminHistory = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['system-history', typeFilter, reviewFilter],
    queryFn: async () => {
      let query = supabase
        .from('system_history' as any)
        .select('*')
        .order('archived_at', { ascending: false })
        .limit(200);

      if (typeFilter !== 'all') {
        query = query.eq('item_type', typeFilter);
      }
      if (reviewFilter !== 'all') {
        query = query.eq('review_status', reviewFilter);
      }

      const { data } = await query;
      return (data || []) as any[];
    },
  });

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-profiles-history'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, username');
      return data || [];
    },
  });

  const getStaffName = (userId: string | null) => {
    if (!userId) return 'Ej tilldelad';
    const p = staffProfiles.find((s: any) => s.user_id === userId);
    return p?.username || userId.slice(0, 8);
  };

  const filtered = history.filter((h: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return h.title?.toLowerCase().includes(s) ||
      h.description?.toLowerCase().includes(s) ||
      h.resolution_notes?.toLowerCase().includes(s);
  });

  return (
    <div className="flex h-full min-h-0 flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Historik</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alla avslutade uppgifter med AI-verifiering och spårbarhet
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sök titel, beskrivning, fix-anteckningar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla typer</SelectItem>
            <SelectItem value="bug">Buggar</SelectItem>
            <SelectItem value="incident">Incidents</SelectItem>
            <SelectItem value="pack_order">Packning</SelectItem>
            <SelectItem value="support_case">Support</SelectItem>
            <SelectItem value="refund_request">Återbetalning</SelectItem>
            <SelectItem value="manual">Manuell</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="AI Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="verified">✅ Verifierade</SelectItem>
            <SelectItem value="needs_review">⚠️ Behöver granskning</SelectItem>
            <SelectItem value="incomplete">❌ Ofullständiga</SelectItem>
            <SelectItem value="pending">⏳ Väntar</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-9 px-3 flex items-center">
          {filtered.length} poster
        </Badge>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Laddar historik...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Ingen historik hittad</p>
          ) : (
            filtered.map((item: any) => {
              const meta = TYPE_META[item.item_type] || TYPE_META.general;
              const TypeIcon = meta.icon;
              const isExpanded = expandedId === item.id;
              const aiResult = item.review_result;

              return (
                <Card key={item.id} className="border-border">
                  <CardContent className="pt-3 pb-3">
                    <div
                      className="flex items-start justify-between gap-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', meta.color)}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium truncate">{item.title}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.archived_at ? format(new Date(item.archived_at), 'yyyy-MM-dd HH:mm') : '–'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              av {getStaffName(item.claimed_by || item.assigned_to)}
                            </span>
                            <Badge variant="outline" className={cn('text-[9px]', meta.color)}>
                              {meta.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn('text-[9px]', REVIEW_STATUS_COLORS[item.review_status || 'pending'])}
                            >
                              {item.review_status === 'verified' ? '✅ Verifierad' :
                               item.review_status === 'needs_review' ? '⚠️ Granskas' :
                               item.review_status === 'incomplete' ? '❌ Ofullständig' : '⏳ Väntar'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 ml-11 space-y-3 border-t border-border pt-3">
                        {item.description && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Beskrivning</p>
                            <p className="text-sm">{item.description}</p>
                          </div>
                        )}

                        {item.resolution_notes && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Fix-anteckningar</p>
                            <p className="text-sm bg-secondary/30 rounded-md p-2">{item.resolution_notes}</p>
                          </div>
                        )}

                        {aiResult && (
                          <div className="bg-secondary/20 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-bold flex items-center gap-1">
                              <Bot className="w-3.5 h-3.5" /> AI-granskning
                            </p>
                            {aiResult.verdict && (
                              <p className="text-sm">{aiResult.verdict}</p>
                            )}
                            {aiResult.risks && aiResult.risks.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Risker:</p>
                                <ul className="text-xs list-disc ml-4 space-y-0.5">
                                  {aiResult.risks.map((r: string, i: number) => (
                                    <li key={i}>{r}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aiResult.edge_cases && aiResult.edge_cases.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Edge cases:</p>
                                <ul className="text-xs list-disc ml-4 space-y-0.5">
                                  {aiResult.edge_cases.map((e: string, i: number) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aiResult.confidence !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                Konfidens: {aiResult.confidence}%
                              </p>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">Skapad:</span>{' '}
                            {item.work_item_created_at ? format(new Date(item.work_item_created_at), 'yyyy-MM-dd HH:mm') : '–'}
                          </div>
                          <div>
                            <span className="font-medium">Klar:</span>{' '}
                            {item.completed_at ? format(new Date(item.completed_at), 'yyyy-MM-dd HH:mm') : '–'}
                          </div>
                          <div>
                            <span className="font-medium">Prioritet:</span> {item.priority}
                          </div>
                          <div>
                            <span className="font-medium">Källa:</span> {item.source_type || 'manual'}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminHistory;
