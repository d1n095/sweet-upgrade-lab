import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('merges multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes (truthy)', () => {
    expect(cn('foo', true && 'bar')).toBe('foo bar');
  });

  it('drops conditional classes that are falsy', () => {
    expect(cn('foo', false && 'bar')).toBe('foo');
  });

  it('drops undefined and null values', () => {
    expect(cn('foo', undefined, null)).toBe('foo');
  });

  it('resolves Tailwind conflicts — later class wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('resolves Tailwind text-color conflicts', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles object syntax', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo');
  });

  it('handles array syntax', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });
});
