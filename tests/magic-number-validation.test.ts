/**
 * Magic Number Validation Tests
 */

import { describe, it, expect } from 'vitest';
import { validateUpload, quickValidate, detectMagicNumber, EXECUTABLE_BLOCKLIST } from '../src/lib/upload/validation.server';

function createMockFile(name: string, type: string, content: Uint8Array): File {
  return new File([content], name, { type });
}

// Magic number buffers
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const JPEG_MAGIC = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]);
const ZIP_MAGIC = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);

describe('detectMagicNumber', () => {
  it('detects PNG files', () => {
    const result = detectMagicNumber(Buffer.from(PNG_MAGIC));
    expect(result).toBe('png');
  });

  it('detects JPEG files', () => {
    const result = detectMagicNumber(Buffer.from(JPEG_MAGIC));
    expect(result).toBe('jpg');
  });

  it('detects PDF files', () => {
    const result = detectMagicNumber(Buffer.from(PDF_MAGIC));
    expect(result).toBe('pdf');
  });

  it('detects ZIP files', () => {
    const result = detectMagicNumber(Buffer.from(ZIP_MAGIC));
    expect(result).toBe('zip');
  });

  it('returns null for unknown files', () => {
    const result = detectMagicNumber(Buffer.from([0x00, 0x00, 0x00, 0x00]));
    expect(result).toBeNull();
  });
});

describe('quickValidate', () => {
  it('accepts valid PNG file', () => {
    const result = quickValidate('image.png', 'image/png', 1024);
    expect(result.valid).toBe(true);
  });

  it('rejects double extension', () => {
    const result = quickValidate('invoice.pdf.exe', 'application/pdf', 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Double extension');
  });

  it('rejects executable files', () => {
    for (const ext of Array.from(EXECUTABLE_BLOCKLIST).slice(0, 5)) {
      const result = quickValidate(`file.${ext}`, 'application/octet-stream', 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Executable');
    }
  });

  it('rejects oversized files', () => {
    const result = quickValidate('image.png', 'image/png', 20 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds');
  });

  it('rejects unknown file types', () => {
    const result = quickValidate('file.xyz', 'application/xyz', 1024);
    expect(result.valid).toBe(false);
  });
});

describe('validateUpload', () => {
  it('accepts valid PNG with matching magic number', async () => {
    const file = createMockFile('image.png', 'image/png', PNG_MAGIC);
    const result = await validateUpload(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe('png');
  });

  it('rejects PNG with wrong magic number', async () => {
    const file = createMockFile('image.png', 'image/png', JPEG_MAGIC);
    const result = await validateUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mismatch');
  });

  it('accepts valid JPEG with matching magic number', async () => {
    const file = createMockFile('image.jpg', 'image/jpeg', JPEG_MAGIC);
    const result = await validateUpload(file);
    expect(result.valid).toBe(true);
  });

  it('rejects double extension attack', async () => {
    const file = createMockFile('document.pdf.exe', 'application/pdf', PDF_MAGIC);
    const result = await validateUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Double extension');
  });
});
