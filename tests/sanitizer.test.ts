/**
 * Sanitizer Tests
 * Tests NFKC normalization, length limits, and sanitizers
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeUnicode,
  normalizeWhitespace,
  removeControlChars,
  truncate,
  search,
  name,
  email,
  phone,
  description,
  notes,
  LENGTH_LIMITS,
} from '../src/lib/sanitize/index';

describe('normalizeUnicode', () => {
  it('normalizes homograph characters', () => {
    // Fullwidth "Ａ" should normalize to "A"
    const result = normalizeUnicode('Ａ');
    expect(result).toBe('A');
  });

  it('normalizes combining characters', () => {
    const result = normalizeUnicode('é'); // e + combining acute
    expect(result).toBe('é'); // Should remain as single character
  });

  it('handles empty string', () => {
    expect(normalizeUnicode('')).toBe('');
  });
});

describe('normalizeWhitespace', () => {
  it('collapses multiple spaces', () => {
    expect(normalizeWhitespace('hello    world')).toBe('hello world');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeWhitespace('  hello world  ')).toBe('hello world');
  });
});

describe('removeControlChars', () => {
  it('removes null bytes', () => {
    expect(removeControlChars('hello\x00world')).toBe('helloworld');
  });

  it('removes control characters', () => {
    expect(removeControlChars('hello\x01world')).toBe('helloworld');
  });

  it('preserves newlines and tabs', () => {
    expect(removeControlChars('hello\nworld\ttab')).toBe('hello\nworld\ttab');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    const long = 'a'.repeat(1000);
    expect(truncate(long, 100).length).toBe(100);
  });

  it('does not truncate short strings', () => {
    expect(truncate('hello', 100)).toBe('hello');
  });
});

describe('search sanitizer', () => {
  it('enforces max length', () => {
    const long = 'a'.repeat(LENGTH_LIMITS.search + 10);
    expect(search(long).length).toBe(LENGTH_LIMITS.search);
  });

  it('normalizes input', () => {
    expect(search('  hello   world  ')).toBe('hello world');
  });
});

describe('name sanitizer', () => {
  it('removes invalid characters', () => {
    expect(name('John<script>alert(1)</script>')).toBe('Johnscriptalert1script');
  });

  it('allows hyphens and apostrophes', () => {
    expect(name("O'Brien-Smith")).toBe("O'Brien-Smith");
  });

  it('enforces max length', () => {
    const long = 'a'.repeat(LENGTH_LIMITS.name + 10);
    expect(name(long).length).toBe(LENGTH_LIMITS.name);
  });
});

describe('email sanitizer', () => {
  it('converts to lowercase', () => {
    expect(email('John.Doe@Example.COM')).toBe('john.doe@example.com');
  });

  it('normalizes whitespace', () => {
    expect(email('  john@example.com  ')).toBe('john@example.com');
  });

  it('enforces max length', () => {
    const long = 'a'.repeat(300) + '@example.com';
    expect(email(long).length).toBe(LENGTH_LIMITS.email);
  });
});

describe('phone sanitizer', () => {
  it('removes non-digit characters', () => {
    expect(phone('+1-555-123-4567')).toBe('15551234567');
  });

  it('enforces max length', () => {
    const long = '1'.repeat(20);
    expect(phone(long).length).toBe(LENGTH_LIMITS.phone);
  });
});

describe('description sanitizer', () => {
  it('enforces max length', () => {
    const long = 'a'.repeat(LENGTH_LIMITS.description + 100);
    expect(description(long).length).toBe(LENGTH_LIMITS.description);
  });
});

describe('notes sanitizer', () => {
  it('enforces max length', () => {
    const long = 'a'.repeat(LENGTH_LIMITS.notes + 100);
    expect(notes(long).length).toBe(LENGTH_LIMITS.notes);
  });
});

describe('LENGTH_LIMITS', () => {
  it('has correct limits', () => {
    expect(LENGTH_LIMITS.search).toBe(100);
    expect(LENGTH_LIMITS.name).toBe(200);
    expect(LENGTH_LIMITS.email).toBe(254);
    expect(LENGTH_LIMITS.phone).toBe(15);
    expect(LENGTH_LIMITS.description).toBe(2000);
    expect(LENGTH_LIMITS.notes).toBe(5000);
  });
});
