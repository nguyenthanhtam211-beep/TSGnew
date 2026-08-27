/**
 * TSG Relational Data Engine (Local-First Architecture)
 * 
 * Inspired by enterprise GitHub systems like Dexie.js, RxDB, and ElectricSQL:
 * 1. Zero Latency: All writes (Create, Update, Delete) are saved to persistent local storage immediately.
 * 2. Never Lost: User manual modifications are tagged and protected against fallback/empty cloud resets.
 * 3. Background Cloud Sync: Non-blocking asynchronous Firestore replication with timeout safeguards.
 * 4. Reactive Event Bus: Dispatches real-time events across all tabs and UI components.
 * 5. 360° Relational Cross-Referencing: Direct query graph linking Suppliers, Customers, Products, POs, Pricing, Contracts & Specs.
 */

import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getItemKey } from '../hooks/useFirestoreCollection';

// Event Name for cross-component reactivity
const DB_CHANGE_EVENT = 'tsg_db_change_event';

export type CollectionName = 
  | 'suppliers'
  | 'customers'
  | 'products'
  | 'pricing'
  | 'po_headers'
  | 'po_lines'
  | 'deliveries'
  | 'contracts'
  | 'specs'
  | 'contacts'
  | 'delivery_plans'
  | 'file_storage'
  | 'tasks'
  | 'projects'
  | 'activities'
  | 'commissions';

export const TSG_DATASET_VERSION = '2026_08_27_ACC_GOLD_V7';

class TSGDataEngine {
  private memoryCache: Map<string, Map<string, any>> = new Map();
  private fallbackStore: Map<string, any[]> = new Map();
  private listeners: Map<string, Set<(data: any[]) => void>> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedVersion = localStorage.getItem('tsg_system_dataset_version');
        if (storedVersion !== TSG_DATASET_VERSION) {
          // Purge all legacy caches to guarantee zero duplication of accounting figures
          const allKeys = Object.keys(localStorage);
          allKeys.forEach(k => {
            if (k.startsWith('tsg_cache_') || k.startsWith('tsg_user_mod_deliveries') || k.startsWith('tsg_dataset_')) {
              localStorage.removeItem(k);
            }
          });
          localStorage.setItem('tsg_system_dataset_version', TSG_DATASET_VERSION);
        }
      } catch (e) {
        console.warn('Dataset version check error:', e);
      }

      // Listen for storage events across browser tabs
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('tsg_cache_')) {
          const colName = e.key.replace(/tsg_cache_.*_/, '');
          this.notifySubscribers(colName as CollectionName);
        }
      });
    }
  }

  /**
   * Register or update fallback dataset for a collection
   */
  public registerFallback(colName: CollectionName, fallbackData: any[]) {
    if (Array.isArray(fallbackData) && fallbackData.length > 0) {
      this.fallbackStore.set(colName, fallbackData);
    }
  }

  /**
   * Get Storage Key for a collection
   */
  private getStorageKey(colName: string): string {
    return `tsg_cache_v5_${colName}`;
  }

  /**
   * Get User Modified Key for tracking manual edits
   */
  private getUserModifiedKey(colName: string): string {
    return `tsg_user_mod_${colName}`;
  }

  /**
   * Get all user-modified IDs in a collection
   */
  private getUserModifiedMap(colName: string): Map<string, any> {
    try {
      const raw = localStorage.getItem(this.getUserModifiedKey(colName));
      if (raw) {
        const obj = JSON.parse(raw);
        return new Map(Object.entries(obj));
      }
    } catch (e) {
      console.warn('Error reading user modified map:', e);
    }
    return new Map();
  }

  /**
   * Save user-modified map to localStorage
   */
  private saveUserModifiedMap(colName: string, map: Map<string, any>) {
    try {
      const obj = Object.fromEntries(map.entries());
      localStorage.setItem(this.getUserModifiedKey(colName), JSON.stringify(obj));
    } catch (e) {
      console.warn('Error saving user modified map:', e);
    }
  }

  /**
   * Load collection from Local Storage into Memory
   */
  private loadCollection(colName: CollectionName, fallbackData: any[] = []): Map<string, any> {
    try {
      // Check if we have active memory cache
      if (this.memoryCache.has(colName) && (!fallbackData || fallbackData.length === 0)) {
        const cachedMap = this.memoryCache.get(colName);
        if (cachedMap && cachedMap.size > 0) return cachedMap;
      }

      const colMap = new Map<string, any>();

      // 1. Resolve fallback data
      if (Array.isArray(fallbackData) && fallbackData.length > 0) {
        this.fallbackStore.set(colName, fallbackData);
      }
      const resolvedFallback = (Array.isArray(fallbackData) && fallbackData.length > 0) 
        ? fallbackData 
        : (this.fallbackStore.get(colName) || []);

      if (Array.isArray(resolvedFallback)) {
        resolvedFallback.forEach(item => {
          if (item && typeof item === 'object') {
            const key = getItemKey(item, colName);
            if (key) colMap.set(key, { ...item });
          }
        });
      }

      // 2. Load cached persistent data (Only allow records that match fallback keys or are explicit user modifications)
      try {
        const cached = localStorage.getItem(this.getStorageKey(colName));
        if (cached) {
          const parsed = JSON.parse(cached);
          const userMods = this.getUserModifiedMap(colName);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach(item => {
              if (item && typeof item === 'object') {
                const key = getItemKey(item, colName);
                if (key && (colMap.has(key) || userMods.has(key))) {
                  if (item.isDeleted === true) {
                    colMap.delete(key);
                  } else {
                    colMap.set(key, { ...(colMap.get(key) || {}), ...item });
                  }
                }
              }
            });
          }
        }
      } catch (e) {
        console.warn(`Error loading cache for ${colName}:`, e);
      }

      // 3. Apply user-modified overrides (guaranteed win over fallback)
      try {
        const userMods = this.getUserModifiedMap(colName);
        userMods.forEach((item, key) => {
          if (item && typeof item === 'object') {
            if (item.isDeleted === true) {
              colMap.delete(key);
            } else {
              colMap.set(key, { ...(colMap.get(key) || {}), ...item });
            }
          }
        });
      } catch (e) {
        console.warn(`Error applying user mods for ${colName}:`, e);
      }

      this.memoryCache.set(colName, colMap);
      return colMap;
    } catch (criticalErr) {
      console.error(`Critical error loading collection ${colName}:`, criticalErr);
      const fallbackMap = new Map<string, any>();
      if (Array.isArray(fallbackData)) {
        fallbackData.forEach(item => {
          if (item) {
            const key = getItemKey(item, colName) || item.id || `item_${Math.random()}`;
            fallbackMap.set(key, item);
          }
        });
      }
      return fallbackMap;
    }
  }

  /**
   * Merge remote Firestore snapshot into local memory and cache
   * Preserves local user-modifications if they haven't been synced yet
   */
  public mergeFirestoreSnapshot(colName: CollectionName, remoteDocs: any[]) {
    try {
      if (!Array.isArray(remoteDocs) || remoteDocs.length === 0) return;

      const colMap = this.loadCollection(colName);
      const userMods = this.getUserModifiedMap(colName);

      remoteDocs.forEach(doc => {
        if (doc && typeof doc === 'object') {
          const key = getItemKey(doc, colName);
          if (key) {
            const sanitizedKey = String(key).replace(/[/\\#?%[\]\s.]+/g, '_');
            
            // Only update if key exists in master collection or is an explicit user mod
            if (colMap.has(sanitizedKey) || colMap.has(key) || userMods.has(sanitizedKey)) {
              if (!userMods.has(sanitizedKey)) {
                const targetKey = colMap.has(sanitizedKey) ? sanitizedKey : key;
                colMap.set(targetKey, { ...(colMap.get(targetKey) || {}), ...doc });
              }
            }
          }
        }
      });

      // Update memory cache
      this.memoryCache.set(colName, colMap);

      // Persist to local storage
      const dataArray = Array.from(colMap.values());
      try {
        localStorage.setItem(this.getStorageKey(colName), JSON.stringify(dataArray));
      } catch (e) {
        console.warn(`Error persisting merged cache for ${colName}:`, e);
      }

      // Notify reactive subscribers
      this.notifySubscribers(colName);
    } catch (err) {
      console.error(`Error merging Firestore snapshot for ${colName}:`, err);
    }
  }

  public getAll(colName: CollectionName, fallbackData: any[] = []): any[] {
    const colMap = this.loadCollection(colName, fallbackData);
    return Array.from(colMap.values());
  }

  /**
   * Get an item by ID or Business Key
   */
  public getById(colName: CollectionName, id: string): any | null {
    if (!id) return null;
    const cleanId = String(id).replace(/[/\\#?%[\]\s.]+/g, '_');
    const colMap = this.loadCollection(colName);
    return colMap.get(cleanId) || null;
  }

  /**
   * Save (Create or Update) an item
   * Guarantees 0ms local persistence + non-blocking cloud replication
   */
  public async save(colName: CollectionName, item: any): Promise<{ success: boolean; id: string; item: any }> {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item data');
    }

    const key = getItemKey(item, colName);
    if (!key) {
      throw new Error(`Cannot determine primary key for item in ${colName}`);
    }

    const sanitizedKey = String(key).replace(/[/\\#?%[\]\s.]+/g, '_');

    // 1. Prepare enriched payload
    const existing = this.getById(colName, sanitizedKey) || {};
    const updatedPayload = {
      ...existing,
      ...item,
      id: item.id || sanitizedKey,
      _userModified: true,
      updatedAt: new Date().toISOString()
    };

    // 2. Update Memory Cache
    const colMap = this.loadCollection(colName);
    colMap.set(sanitizedKey, updatedPayload);
    this.memoryCache.set(colName, colMap);

    // 3. Save to User Modified Map
    const userMods = this.getUserModifiedMap(colName);
    userMods.set(sanitizedKey, updatedPayload);
    this.saveUserModifiedMap(colName, userMods);

    // 4. Save to Persistent Local Cache
    try {
      const allItems = Array.from(colMap.values());
      localStorage.setItem(this.getStorageKey(colName), JSON.stringify(allItems));
    } catch (e) {
      console.warn(`LocalStorage write warning for ${colName}:`, e);
    }

    // 5. Notify subscribers
    this.notifySubscribers(colName);

    // 6. Non-blocking Background Sync to Firestore (with 3.5s safeguard)
    this.backgroundFirestoreSync(colName, sanitizedKey, updatedPayload);

    return { success: true, id: sanitizedKey, item: updatedPayload };
  }

  /**
   * Batch Save (Create or Update multiple items at once)
   * High performance: single localStorage write and single subscriber notification
   */
  public async saveBatch(colName: CollectionName, items: any[]): Promise<{ success: boolean; count: number }> {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, count: 0 };
    }

    const colMap = this.loadCollection(colName);
    const userMods = this.getUserModifiedMap(colName);
    let count = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const key = getItemKey(item, colName);
      if (!key) continue;
      const sanitizedKey = String(key).replace(/[/\\#?%[\]\s.]+/g, '_');

      const existing = colMap.get(sanitizedKey) || {};
      const updatedPayload = {
        ...existing,
        ...item,
        id: item.id || sanitizedKey,
        _userModified: true,
        updatedAt: new Date().toISOString()
      };

      colMap.set(sanitizedKey, updatedPayload);
      userMods.set(sanitizedKey, updatedPayload);
      count++;
    }

    this.memoryCache.set(colName, colMap);
    this.saveUserModifiedMap(colName, userMods);

    try {
      const allItems = Array.from(colMap.values());
      localStorage.setItem(this.getStorageKey(colName), JSON.stringify(allItems));
    } catch (e) {
      console.warn(`LocalStorage batch write warning for ${colName}:`, e);
    }

    this.notifySubscribers(colName);
    return { success: true, count };
  }

  /**
   * Delete an item
   */
  public async delete(colName: CollectionName, id: string): Promise<{ success: boolean; id: string }> {
    if (!id) throw new Error('ID required for deletion');
    const sanitizedKey = String(id).replace(/[/\\#?%[\]\s.]+/g, '_');

    // 1. Update Memory Cache
    const colMap = this.loadCollection(colName);
    colMap.delete(sanitizedKey);
    this.memoryCache.set(colName, colMap);

    // 2. Save deletion marker in User Modified Map
    const userMods = this.getUserModifiedMap(colName);
    userMods.set(sanitizedKey, { isDeleted: true, deletedAt: new Date().toISOString(), _userModified: true });
    this.saveUserModifiedMap(colName, userMods);

    // 3. Save to Persistent Local Cache
    try {
      const allItems = Array.from(colMap.values());
      localStorage.setItem(this.getStorageKey(colName), JSON.stringify(allItems));
    } catch (e) {
      console.warn(`LocalStorage write warning for ${colName}:`, e);
    }

    // 4. Notify subscribers
    this.notifySubscribers(colName);

    // 5. Non-blocking Background Sync to Firestore
    this.backgroundFirestoreSync(colName, sanitizedKey, { isDeleted: true, deletedAt: new Date().toISOString() });

    return { success: true, id: sanitizedKey };
  }

  /**
   * Non-blocking Firestore Sync with Timeout Safeguard
   */
  private async backgroundFirestoreSync(colName: string, docId: string, payload: any) {
    try {
      const firestoreWrite = setDoc(doc(db, colName, docId), payload, { merge: true });
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 3500));
      await Promise.race([firestoreWrite, timeoutPromise]);
    } catch (err) {
      console.warn(`Background Firestore sync for ${colName}/${docId}:`, err);
    }
  }

  /**
   * Notify memory subscribers
   */
  private notifySubscribers(colName: CollectionName) {
    const subs = this.listeners.get(colName);
    if (subs && subs.size > 0) {
      const items = this.getAll(colName);
      subs.forEach(cb => {
        try {
          cb(items);
        } catch (e) {
          console.error(`Error in subscriber callback for ${colName}:`, e);
        }
      });
    }
  }

  /**
   * Subscribe to real-time changes in a collection
   */
  public subscribe(colName: CollectionName, callback: (data: any[]) => void): () => void {
    if (!this.listeners.has(colName)) {
      this.listeners.set(colName, new Set());
    }
    this.listeners.get(colName)!.add(callback);

    return () => {
      this.listeners.get(colName)?.delete(callback);
    };
  }

  /**
   * 360° Relational Graph Query for Supplier
   */
  public getSupplierCrossReference(supplierIdOrCode: string) {
    if (!supplierIdOrCode) return null;
    const target = String(supplierIdOrCode).toLowerCase().trim();

    const suppliers = this.getAll('suppliers');
    const products = this.getAll('products');
    const pricing = this.getAll('pricing');
    const poHeaders = this.getAll('po_headers');
    const contracts = this.getAll('contracts');
    const contacts = this.getAll('contacts');

    const supplier = suppliers.find(s => 
      s.id?.toLowerCase() === target ||
      s["Mã nhà cung cấp"]?.toLowerCase() === target ||
      s["Tên Nhà Cung Cấp"]?.toLowerCase().includes(target)
    ) || null;

    const suppCode = supplier?.["Mã nhà cung cấp"]?.toLowerCase() || target;
    const suppName = supplier?.["Tên Nhà Cung Cấp"]?.toLowerCase() || target;

    // 1. Matched Products
    const matchedProducts = products.filter(p => {
      const pSupp = String(p["Nhà cung cấp"] || p["Mã Nhà Cung Cấp"] || p.supplier || '').toLowerCase();
      return pSupp.includes(suppCode) || pSupp.includes(suppName) || target.includes(pSupp);
    });

    // 2. Matched Pricing
    const matchedPricing = pricing.filter(pr => {
      const prSupp = String(pr["Nhà cung cấp"] || pr["Mã NCC"] || pr["Mã nhà cung cấp"] || '').toLowerCase();
      return prSupp.includes(suppCode) || prSupp.includes(suppName);
    });

    // 3. Matched POs
    const matchedPOs = poHeaders.filter(po => {
      const poSupp = String(po["Nhà cung cấp"] || po["Mã NCC"] || po["NCC"] || '').toLowerCase();
      return poSupp.includes(suppCode) || poSupp.includes(suppName);
    });

    // 4. Matched Contracts
    const matchedContracts = contracts.filter(c => {
      const cSupp = String(c["Nhà cung cấp"] || c["Đối tác"] || c["Mã NCC"] || '').toLowerCase();
      return cSupp.includes(suppCode) || cSupp.includes(suppName);
    });

    // 5. Matched Contacts
    const matchedContacts = contacts.filter(ct => {
      const ctComp = String(ct["Công ty"] || ct["Doanh nghiệp"] || '').toLowerCase();
      return ctComp.includes(suppCode) || ctComp.includes(suppName);
    });

    return {
      supplier,
      products: matchedProducts,
      pricing: matchedPricing,
      pos: matchedPOs,
      contracts: matchedContracts,
      contacts: matchedContacts
    };
  }

  /**
   * 360° Relational Graph Query for Customer
   */
  public getCustomerCrossReference(customerIdOrCode: string) {
    if (!customerIdOrCode) return null;
    const target = String(customerIdOrCode).toLowerCase().trim();

    const customers = this.getAll('customers');
    const products = this.getAll('products');
    const pricing = this.getAll('pricing');
    const poHeaders = this.getAll('po_headers');
    const contracts = this.getAll('contracts');
    const contacts = this.getAll('contacts');

    const customer = customers.find(c => 
      c.id?.toLowerCase() === target ||
      c.Customer_ID?.toLowerCase() === target ||
      c["Mã KH"]?.toLowerCase() === target ||
      c["Tên đầy đủ"]?.toLowerCase().includes(target)
    ) || null;

    const custCode = customer?.Customer_ID?.toLowerCase() || customer?.["Mã KH"]?.toLowerCase() || target;
    const custName = customer?.["Tên đầy đủ"]?.toLowerCase() || target;

    const matchedProducts = products.filter(p => {
      const pCust = String(p["Khách hàng"] || p["Mã KH"] || p.customer || '').toLowerCase();
      return pCust.includes(custCode) || pCust.includes(custName);
    });

    const matchedPricing = pricing.filter(pr => {
      const prCust = String(pr["Khách hàng"] || pr["Mã KH"] || '').toLowerCase();
      return prCust.includes(custCode) || prCust.includes(custName);
    });

    const matchedPOs = poHeaders.filter(po => {
      const poCust = String(po["Khách hàng"] || po["Mã KH"] || '').toLowerCase();
      return poCust.includes(custCode) || poCust.includes(custName);
    });

    const matchedContracts = contracts.filter(c => {
      const cCust = String(c["Khách hàng"] || c["Đối tác"] || '').toLowerCase();
      return cCust.includes(custCode) || cCust.includes(custName);
    });

    const matchedContacts = contacts.filter(ct => {
      const ctComp = String(ct["Công ty"] || ct["Doanh nghiệp"] || '').toLowerCase();
      return ctComp.includes(custCode) || ctComp.includes(custName);
    });

    return {
      customer,
      products: matchedProducts,
      pricing: matchedPricing,
      pos: matchedPOs,
      contracts: matchedContracts,
      contacts: matchedContacts
    };
  }
}

export const dbEngine = new TSGDataEngine();
export default dbEngine;
