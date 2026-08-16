/**
 * Sanitize Integration Module
 * Bridges the new sanitize library with existing form inputs
 * Usage: import { sanitizeFormInput } from '@/lib/integrations/sanitize-form';
 */

import { search, name, email, phone, description, notes, sanitize } from '../sanitize/index';

export interface FormFieldConfig {
  field: string;
  type: 'search' | 'name' | 'email' | 'phone' | 'description' | 'notes' | 'generic';
  maxLength?: number;
}

/**
 * Sanitize a single form field based on its type
 */
export function sanitizeFormField(value: string, config: FormFieldConfig): string {
  switch (config.type) {
    case 'search':
      return search(value);
    case 'name':
      return name(value);
    case 'email':
      return email(value);
    case 'phone':
      return phone(value);
    case 'description':
      return description(value);
    case 'notes':
      return notes(value);
    case 'generic':
    default:
      return sanitize(value, { maxLength: config.maxLength });
  }
}

/**
 * Sanitize an entire form object
 */
export function sanitizeFormInput<T extends Record<string, string>>(
  formData: T,
  configs: FormFieldConfig[]
): T {
  const result = { ...formData } as Record<string, string>;
  for (const config of configs) {
    if (result[config.field] !== undefined) {
      result[config.field] = sanitizeFormField(result[config.field], config);
    }
  }
  return result as T;
}

/**
 * Common form field configurations for the pharmacy system
 */
export const PHARMACY_FORM_CONFIGS: FormFieldConfig[] = [
  { field: 'patientName', type: 'name' },
  { field: 'doctorName', type: 'name' },
  { field: 'email', type: 'email' },
  { field: 'phone', type: 'phone' },
  { field: 'searchQuery', type: 'search' },
  { field: 'medicationDescription', type: 'description' },
  { field: 'notes', type: 'notes' },
  { field: 'diagnosis', type: 'description' },
];

export { search, name, email, phone, description, notes, sanitize };
