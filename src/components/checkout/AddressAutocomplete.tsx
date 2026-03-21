import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressResult {
  address: string;
  postal_code: string;
  city: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const DEBOUNCE_MS = 300;

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  onBlur,
  placeholder,
  className,
  id,
}: AddressAutocompleteProps) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(false);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-places?action=autocomplete&input=${encodeURIComponent(input)}`,
        { headers: { apikey: anonKey } }
      );
      const data = await res.json();
      setPredictions(data.predictions || []);
      setIsOpen((data.predictions || []).length > 0);
    } catch {
      setPredictions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchPredictions(val), DEBOUNCE_MS);
  };

  const handleSelect = async (prediction: Prediction) => {
    setIsOpen(false);
    setPredictions([]);
    suppressRef.current = true;

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-places?action=details&place_id=${encodeURIComponent(prediction.place_id)}`,
        { headers: { apikey: anonKey } }
      );
      const data = await res.json();
      if (data.address) {
        onSelect({
          address: data.address,
          postal_code: data.postal_code || '',
          city: data.city || '',
        });
      }
    } catch {
      // Fallback: just use the description
      onChange(prediction.description);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        autoComplete="off"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={onBlur}
        onFocus={() => { if (predictions.length > 0) setIsOpen(true); }}
        placeholder={placeholder}
        className={className}
      />
      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(p)}
            >
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {p.structured_formatting?.main_text || p.description}
                </p>
                {p.structured_formatting?.secondary_text && (
                  <p className="text-xs text-muted-foreground truncate">
                    {p.structured_formatting.secondary_text}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
