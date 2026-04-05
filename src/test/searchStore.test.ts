import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore } from '@/stores/searchStore';

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({ searchQuery: '' });
  });

  it('initialises with an empty search query', () => {
    expect(useSearchStore.getState().searchQuery).toBe('');
  });

  it('updates the search query', () => {
    useSearchStore.getState().setSearchQuery('candy');
    expect(useSearchStore.getState().searchQuery).toBe('candy');
  });

  it('replaces the previous query', () => {
    useSearchStore.getState().setSearchQuery('first');
    useSearchStore.getState().setSearchQuery('second');
    expect(useSearchStore.getState().searchQuery).toBe('second');
  });

  it('accepts an empty string to clear the query', () => {
    useSearchStore.getState().setSearchQuery('something');
    useSearchStore.getState().setSearchQuery('');
    expect(useSearchStore.getState().searchQuery).toBe('');
  });

  it('stores whitespace-only queries as-is', () => {
    useSearchStore.getState().setSearchQuery('   ');
    expect(useSearchStore.getState().searchQuery).toBe('   ');
  });
});
