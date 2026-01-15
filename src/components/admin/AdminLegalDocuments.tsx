import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Edit, Save, Loader2, RefreshCw, 
  Eye, History, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LegalDocument {
  id: string;
  document_type: string;
  title_sv: string;
  title_en: string;
  content_sv: string;
  content_en: string;
  version: number;
  is_active: boolean;
  updated_at: string;
}

interface DocumentVersion {
  id: string;
  version: number;
  title_sv: string;
  content_sv: string;
  created_at: string;
}

const AdminLegalDocuments = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const [editData, setEditData] = useState({
    title_sv: '',
    title_en: '',
    content_sv: '',
    content_en: '',
  });

  const content = {
    sv: {
      title: 'Juridiska dokument',
      subtitle: 'Hantera villkor och policies',
      selectDoc: 'Välj dokument',
      edit: 'Redigera',
      save: 'Spara ändringar',
      cancel: 'Avbryt',
      preview: 'Förhandsgranska',
      versions: 'Versionshistorik',
      version: 'Version',
      swedish: 'Svenska',
      english: 'Engelska',
      titleLabel: 'Titel',
      contentLabel: 'Innehåll (Markdown)',
      lastUpdated: 'Senast uppdaterad',
      success: 'Dokument uppdaterat!',
      noVersions: 'Ingen versionshistorik',
      documents: {
        terms: 'Allmänna villkor',
        privacy: 'Integritetspolicy',
        affiliate: 'Affiliate-avtal',
      }
    },
    en: {
      title: 'Legal Documents',
      subtitle: 'Manage terms and policies',
      selectDoc: 'Select document',
      edit: 'Edit',
      save: 'Save changes',
      cancel: 'Cancel',
      preview: 'Preview',
      versions: 'Version history',
      version: 'Version',
      swedish: 'Swedish',
      english: 'English',
      titleLabel: 'Title',
      contentLabel: 'Content (Markdown)',
      lastUpdated: 'Last updated',
      success: 'Document updated!',
      noVersions: 'No version history',
      documents: {
        terms: 'Terms & Conditions',
        privacy: 'Privacy Policy',
        affiliate: 'Affiliate Agreement',
      }
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .order('document_type');

      if (error) throw error;
      setDocuments((data || []) as LegalDocument[]);
      
      if (data && data.length > 0 && !selectedDoc) {
        selectDocument(data[0] as LegalDocument);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectDocument = async (doc: LegalDocument) => {
    setSelectedDoc(doc);
    setEditData({
      title_sv: doc.title_sv,
      title_en: doc.title_en,
      content_sv: doc.content_sv,
      content_en: doc.content_en,
    });
    setIsEditing(false);

    // Load versions
    try {
      const { data } = await supabase
        .from('legal_document_versions')
        .select('*')
        .eq('document_id', doc.id)
        .order('version', { ascending: false });
      
      setVersions((data || []) as DocumentVersion[]);
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  };

  const saveDocument = async () => {
    if (!selectedDoc || !user) return;
    
    setIsSaving(true);
    try {
      // Save current version to history
      await supabase
        .from('legal_document_versions')
        .insert({
          document_id: selectedDoc.id,
          version: selectedDoc.version,
          title_sv: selectedDoc.title_sv,
          title_en: selectedDoc.title_en,
          content_sv: selectedDoc.content_sv,
          content_en: selectedDoc.content_en,
          created_by: user.id,
        });

      // Update document
      const { error } = await supabase
        .from('legal_documents')
        .update({
          title_sv: editData.title_sv,
          title_en: editData.title_en,
          content_sv: editData.content_sv,
          content_en: editData.content_en,
          version: selectedDoc.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDoc.id);

      if (error) throw error;

      toast.success(t.success);
      setIsEditing(false);
      loadDocuments();
    } catch (error) {
      console.error('Failed to save document:', error);
      toast.error('Error saving document');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDocumentLabel = (type: string) => {
    return t.documents[type as keyof typeof t.documents] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadDocuments} className="gap-2">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Document Selector */}
      <div className="flex items-center gap-4">
        <Select
          value={selectedDoc?.document_type || ''}
          onValueChange={(value) => {
            const doc = documents.find(d => d.document_type === value);
            if (doc) selectDocument(doc);
          }}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={t.selectDoc} />
          </SelectTrigger>
          <SelectContent>
            {documents.map((doc) => (
              <SelectItem key={doc.id} value={doc.document_type}>
                {getDocumentLabel(doc.document_type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedDoc && !isEditing && (
          <Button onClick={() => setIsEditing(true)} className="gap-2">
            <Edit className="w-4 h-4" />
            {t.edit}
          </Button>
        )}
      </div>

      {/* Document Editor */}
      {selectedDoc && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-lg">
                {isEditing ? (language === 'sv' ? editData.title_sv : editData.title_en) : (language === 'sv' ? selectedDoc.title_sv : selectedDoc.title_en)}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t.version} {selectedDoc.version} • {t.lastUpdated}: {formatDate(selectedDoc.updated_at)}
              </p>
            </div>
          </div>

          {isEditing ? (
            <Tabs defaultValue="sv" className="space-y-4">
              <TabsList>
                <TabsTrigger value="sv">🇸🇪 {t.swedish}</TabsTrigger>
                <TabsTrigger value="en">🇬🇧 {t.english}</TabsTrigger>
              </TabsList>

              <TabsContent value="sv" className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.titleLabel}</Label>
                  <Input
                    value={editData.title_sv}
                    onChange={(e) => setEditData({ ...editData, title_sv: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.contentLabel}</Label>
                  <Textarea
                    value={editData.content_sv}
                    onChange={(e) => setEditData({ ...editData, content_sv: e.target.value })}
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="en" className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.titleLabel}</Label>
                  <Input
                    value={editData.title_en}
                    onChange={(e) => setEditData({ ...editData, title_en: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.contentLabel}</Label>
                  <Textarea
                    value={editData.content_en}
                    onChange={(e) => setEditData({ ...editData, content_en: e.target.value })}
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveDocument} disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {t.save}
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    title_sv: selectedDoc.title_sv,
                    title_en: selectedDoc.title_en,
                    content_sv: selectedDoc.content_sv,
                    content_en: selectedDoc.content_en,
                  });
                }}>
                  {t.cancel}
                </Button>
              </div>
            </Tabs>
          ) : (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                {language === 'sv' ? selectedDoc.content_sv : selectedDoc.content_en}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Version History */}
      {selectedDoc && versions.length > 0 && (
        <Collapsible open={showVersions} onOpenChange={setShowVersions}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <History className="w-4 h-4" />
                {t.versions}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showVersions ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="p-3 bg-secondary/50 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.version} {version.version}</span>
                  <span className="text-muted-foreground">{formatDate(version.created_at)}</span>
                </div>
                <p className="text-muted-foreground mt-1 truncate">{version.title_sv}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default AdminLegalDocuments;