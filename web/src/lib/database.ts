/**
 * Database Facade
 *
 * Provides a single import point for the database layer.
 * Flipping USE_SQLITE to false reverts to the legacy IndexedDB implementation.
 *
 * Usage:
 *   import { db } from '../lib/database'
 *   // same API regardless of backend
 */

import { SQLiteDatabaseService, sqlDb } from './sqlite'

// Feature flag — flip to false to revert to IndexedDB
export const USE_SQLITE = true

export const db = sqlDb

// Re-export types that consumers need
export type { HistoryItem, TMDBMetadata } from './sqlite'
export { SQLiteDatabaseService }
