/**
 * 文件搜索输入框
 */

import { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, Loader2 } from 'lucide-react';

interface FileSearchInputProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export function FileSearchInput({ onSearch, loading }: FileSearchInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="搜索文件..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" disabled={loading || !query.trim()}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}
