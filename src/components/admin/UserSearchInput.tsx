import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, User, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface UserResult {
  user_id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
}

interface UserSearchInputProps {
  onSelect: (user: UserResult) => void;
  placeholder?: string;
  selectedUser?: UserResult | null;
  onClear?: () => void;
}

const UserSearchInput = ({ onSelect, placeholder, selectedUser, onClear }: UserSearchInputProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc('admin_search_users', {
          p_query: query.trim(),
        });
        if (error) throw error;
        setResults((data || []) as UserResult[]);
        setShowDropdown(true);
      } catch (err) {
        console.error('User search failed:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = (user: UserResult) => {
    onSelect(user);
    setQuery('');
    setShowDropdown(false);
    setResults([]);
  };

  // Show selected user chip
  if (selectedUser) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-secondary/30">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
          {selectedUser.username?.charAt(0)?.toUpperCase() || selectedUser.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selectedUser.username || '—'}</p>
          <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded hover:bg-secondary transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          placeholder={placeholder || 'Sök användarnamn, email eller telefon...'}
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-card border border-border shadow-lg overflow-hidden max-h-60 overflow-y-auto"
          >
            {results.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Inga användare hittades
              </div>
            ) : (
              results.map((user) => (
                <button
                  key={user.user_id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                    {user.username?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.username || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserSearchInput;
