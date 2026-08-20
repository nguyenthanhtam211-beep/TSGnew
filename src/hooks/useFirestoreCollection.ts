import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

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
    const pxk = item["Số PXK"] || '';
    const stt = item["STT"] || item["id"] || '';
    const lineId = item["Chi tiết đơn hàng"] || '';
    if (pxk && stt) {
      rawKey = `${pxk}_${stt}`;
    } else if (stt) {
      rawKey = String(stt);
    } else if (pxk && lineId) {
      rawKey = `${pxk}_${lineId}`;
    } else {
      rawKey = pxk || lineId || (item.id ? String(item.id) : '');
    }
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
      const cached = localStorage.getItem(`tsg_cache_${collectionName}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return fallbackData;
  });

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      const colRef = collection(db, collectionName);
      unsubscribe = onSnapshot(colRef, (snapshot) => {
        if (!snapshot.empty) {
          const firestoreData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          
          const mergedMap = new Map<string, any>();
          
          if (Array.isArray(fallbackData)) {
            fallbackData.forEach(item => {
              const key = getItemKey(item, collectionName);
              if (key) mergedMap.set(key, { ...item });
            });
          }
          
          firestoreData.forEach(item => {
            const key = getItemKey(item, collectionName);
            if (key) {
              if (item.isDeleted === true) {
                mergedMap.delete(key);
              } else {
                const existing = mergedMap.get(key) || {};
                const mergedItem = { ...existing, ...item };
                // Keep fallback critical identifiers if Firestore document had stripped them
                if (!mergedItem['Tên sản phẩm'] && existing['Tên sản phẩm']) {
                  mergedItem['Tên sản phẩm'] = existing['Tên sản phẩm'];
                }
                if (!mergedItem['Mã sản phẩm'] && existing['Mã sản phẩm']) {
                  mergedItem['Mã sản phẩm'] = existing['Mã sản phẩm'];
                }
                if (!mergedItem['Đơn Vị Tính'] && existing['Đơn Vị Tính']) {
                  mergedItem['Đơn Vị Tính'] = existing['Đơn Vị Tính'];
                }
                mergedMap.set(key, mergedItem);
              }
            }
          });
          
          const result = Array.from(mergedMap.values());
          setData(result);
          try {
            localStorage.setItem(`tsg_cache_${collectionName}`, JSON.stringify(result));
          } catch (e) {}
        } else {
          setData(fallbackData);
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

    return () => unsubscribe();
  }, [collectionName, fallbackData]);

  return data;
}

