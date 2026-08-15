import { initializeApp } from "firebase/app";
import { getFirestore, collection, writeBatch, doc } from "firebase/firestore";
import Papa from "papaparse";
import { CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA } from "./src/data.ts";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const parseCSV = (csv) => {
  const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return result.data;
};

async function seed() {
  const customers = parseCSV(CUSTOMER_DATA);
  const suppliers = parseCSV(SUPPLIER_DATA);
  const contacts = parseCSV(CONTACT_DATA);
  
  console.log(`Found ${customers.length} customers, ${suppliers.length} suppliers, ${contacts.length} contacts.`);
  
  const batch1 = writeBatch(db);
  customers.forEach(c => {
    if (c["Customer_ID"]) {
      const docRef = doc(collection(db, "customers"), c["Customer_ID"]);
      batch1.set(docRef, c);
    }
  });
  
  const batch2 = writeBatch(db);
  suppliers.forEach(s => {
    if (s["Mã nhà cung cấp"]) {
      const docRef = doc(collection(db, "suppliers"), s["Mã nhà cung cấp"]);
      batch2.set(docRef, s);
    }
  });

  const batch3 = writeBatch(db);
  contacts.forEach(cnt => {
    if (cnt["ID"]) {
      const docRef = doc(collection(db, "contacts"), cnt["ID"]);
      batch3.set(docRef, cnt);
    }
  });
  
  await batch1.commit();
  await batch2.commit();
  await batch3.commit();
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
