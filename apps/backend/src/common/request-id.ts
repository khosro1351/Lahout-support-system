import { randomUUID } from 'node:crypto';

export function getOrCreateRequestId(value?: string): string {
  return value?.trim() || randomUUID();
}
