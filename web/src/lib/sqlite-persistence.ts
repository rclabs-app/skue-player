/**
 * SQLite Persistence Layer
 *
 * Saves and loads the raw SQLite database binary to persistent storage.
 * Uses OPFS (Origin Private File System) when available for maximum speed,
 * with IndexedDB blob fallback for older browsers (Smart TV WebViews).
 *
 * OPFS is ~10x faster than IDB for binary blobs because it avoids
 * structured cloning and transaction overhead.
 */

const OPFS_FILENAME = 'skue.db'
const IDB_DB_NAME = 'skue-sqlite-persistence'
const IDB_STORE = 'database'
const IDB_KEY = 'main'

// ─── Public API ──────────────────────────────────────────────────────────────

export async function saveDatabase(data: Uint8Array): Promise<void> {
  if (await supportsOPFS()) {
    try {
      await saveToOPFS(data)
      return
    } catch (e) {
      console.warn('OPFS save failed, falling back to IDB:', e)
      _supportsOPFS = false
    }
  }
  return saveToIDB(data)
}

export async function loadDatabase(): Promise<Uint8Array | null> {
  if (await supportsOPFS()) {
    try {
      const data = await loadFromOPFS()
      if (data) return data
    } catch (e) {
      console.warn('OPFS load failed, falling back to IDB:', e)
      _supportsOPFS = false
    }
  }
  return loadFromIDB()
}

export async function deleteDatabase(): Promise<void> {
  if (await supportsOPFS()) {
    return deleteFromOPFS()
  }
  return deleteFromIDB()
}

// ─── OPFS (Origin Private File System) ──────────────────────────────────────

let _supportsOPFS: boolean | null = null

async function supportsOPFS(): Promise<boolean> {
  if (_supportsOPFS !== null) return _supportsOPFS
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      _supportsOPFS = false
      return false
    }
    // Quick test — some browsers declare getDirectory() but throw when called
    await navigator.storage.getDirectory()
    _supportsOPFS = true
  } catch {
    _supportsOPFS = false
  }
  return _supportsOPFS
}

async function saveToOPFS(data: Uint8Array): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle(OPFS_FILENAME, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
}

async function loadFromOPFS(): Promise<Uint8Array | null> {
  try {
    const root = await navigator.storage.getDirectory()
    const fileHandle = await root.getFileHandle(OPFS_FILENAME)
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    // File doesn't exist yet
    return null
  }
}

async function deleteFromOPFS(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(OPFS_FILENAME)
  } catch {
    // File doesn't exist — that's fine
  }
}

// ─── IndexedDB Blob Fallback ────────────────────────────────────────────────

function openIDB(dbName: string = IDB_DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
  })
}

async function readFromDb(dbName: string): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB(dbName)
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly')
      const store = tx.objectStore(IDB_STORE)
      const req = store.get(IDB_KEY)
      req.onsuccess = () => {
        idb.close()
        resolve(req.result ? new Uint8Array(req.result) : null)
      }
      req.onerror = () => { idb.close(); reject(req.error) }
    })
  } catch {
    return null
  }
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  const idb = await openIDB(IDB_DB_NAME)
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    store.put(data, IDB_KEY)
    tx.oncomplete = () => { idb.close(); resolve() }
    tx.onerror = () => { idb.close(); reject(tx.error) }
  })
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  return readFromDb(IDB_DB_NAME)
}

async function deleteFromIDB(): Promise<void> {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    store.delete(IDB_KEY)
    tx.oncomplete = () => { idb.close(); resolve() }
    tx.onerror = () => { idb.close(); reject(tx.error) }
  })
}
