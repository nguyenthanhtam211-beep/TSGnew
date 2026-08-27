import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import dbEngine, { CollectionName } from '../lib/dbEngine';

export function getItemKey(item: any, collectionName?: string): string {
  if (!item || typeof item !== 'object') return '';

  let rawKey = '';

  if (item.id) {
    rawKey = String(item.id);
  } else if (collectionName === 'file_storage' && (item.fileId || item.file_id)) {
    rawKey = String(item.fileId || item.file_id);
  } else if (collectionName === 'specs' && item.specId) {
    rawKey = String(item.specId);
  } else if (collectionName === 'po_headers' && (item["Số đơn hàng"] || item["Đơn hàng"])) {
    rawKey = String(item["Số đơn hàng"] || item["Đơn hàng"]);
  } else if (collectionName === 'po_lines') {
    const parent = item["Số đơn hàng"] || item["Đơn hàng"] || '';
    const stt = item["STT"] || item["Chi tiết đơn hàng"] || '';
    rawKey = stt ? `${parent}_${stt}` : parent;
  } else if (collectionName === 'deliveries') {
    const rawDeliveryId = item.id || (item["STT"] !== undefined && item["STT"] !== '' ? `DEL_${item["STT"]}` : (item["Số PXK"] ? `${item["Số PXK"]}_${item["Mã sản phẩm"] || item["Tên sản phẩm"]}` : ''));
    rawKey = String(rawDeliveryId);
  } else if (item["STT"] && (item["Đơn hàng"] || item["Số đơn hàng"] || item["Số PXK"])) {
    const parentId = item["Số PXK"] || item["Đơn hàng"] || item["Số đơn hàng"];
    const sku = item["Mã hàng"] || item["Tên sản phẩm"] || "";
    rawKey = `${parentId}_${sku}_${item["STT"]}`;
  } else if (item["STT"] && item["Mã KH"]) {
    rawKey = `${item["Mã KH"]}_${item["STT"]}`;
  } else if (collectionName === 'contacts') {
    const cId = item.id || item.ID || (item["Tên"] && item["Công ty"] ? `${item["Tên"]}_${item["Công ty"]}` : item["Tên"]);
    rawKey = String(cId || '');
  } else if (item["STT"] && (item["Mã nhà cung cấp"] || item["Mã NCC"])) {
    rawKey = `${item["Mã nhà cung cấp"] || item["Mã NCC"]}_${item["STT"]}`;
  } else {
    const businessId = item.fileId ||
                       item.file_id ||
                       item.specId ||
                       item.ID || 
                       item.Customer_ID || 
                       item["Mã nhà cung cấp"] || 
                       item["Mã giá bán"] || 
                       item["Mã sản phẩm"] ||
                       item["Mã hàng"] ||
                       item["Mã kế hoạch"] ||
                       item["Số PXK"] ||
                       item["Đơn hàng"] || 
                       item["Số đơn hàng"] ||
                       item["STT"] ||
                       item.id;
    if (businessId) {
      rawKey = String(businessId);
    }
  }

  if (rawKey) {
    // Sanitize rawKey for Firestore doc ID (replace slashes, spaces, hashes, dots, etc.)
    return rawKey.replace(/[/\\#?%[\]\s.]+/g, '_');
  }

  // Fallback: create a safe hash or clean identifier without slashes
  try {
    const { id, ...rest } = item;
    const str = JSON.stringify(rest);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `item_${Math.abs(hash)}`;
  } catch (e) {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
}

export function useFirestoreCollection(collectionName: string, fallbackData: any[]) {
  const [data, setData] = useState<any[]>(() => {
    try {
      const initial = dbEngine.getAll(collectionName as CollectionName, fallbackData);
      if (Array.isArray(initial) && initial.length > 0) return initial;
    } catch (e) {
      // ignore
    }
    return fallbackData || [];
  });

  useEffect(() => {
    // Register fallback data in data engine
    dbEngine.registerFallback(collectionName as CollectionName, fallbackData);

    // 1. Subscribe to local reactive Data Engine (instant local updates)
    const unsubLocal = dbEngine.subscribe(collectionName as CollectionName, (updatedData) => {
      if (Array.isArray(updatedData) && updatedData.length > 0) {
        setData(updatedData);
      }
    });

    // 2. Subscribe to remote Firestore for cloud synchronization
    let unsubFirestore = () => {};

    try {
      const colRef = collection(db, collectionName);
      unsubFirestore = onSnapshot(colRef, (snapshot) => {
        if (!snapshot.empty) {
          const docs: any[] = [];
          snapshot.forEach(doc => {
            docs.push({ id: doc.id, ...doc.data() });
          });
          dbEngine.mergeFirestoreSnapshot(collectionName as CollectionName, docs);
          const currentAll = dbEngine.getAll(collectionName as CollectionName, fallbackData);
          if (Array.isArray(currentAll) && currentAll.length > 0) {
            setData(currentAll);
          }
        }
      }, (error) => {
        // Silently fallback without crashing UI
        if (error?.message && !error.message.includes('not found')) {
          console.warn(`Firestore sync note for ${collectionName}:`, error.message);
        }
      });
    } catch (err) {
      // Handle missing db or initialization errors gracefully
    }

    return () => {
      unsubLocal();
      unsubFirestore();
    };
  }, [collectionName, fallbackData]);

  return data;
}
