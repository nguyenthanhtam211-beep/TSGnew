import Papa from "papaparse";
import fs from "fs";
let match = fs.readFileSync("src/data.ts", "utf8").match(/export const CUSTOMER_DATA = `([\s\S]*?)`;/);
if (match) {
  let data = Papa.parse(match[1].trim(), { header: true, skipEmptyLines: true }).data;
  console.log("Papa Parse version:", Papa.RECORD_SEP);
  console.log("Customer array length:", data.length);
  data.forEach((d, i) => console.log(i, d.Customer_ID));
}
