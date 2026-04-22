import Papa from "papaparse";

export const parseCSVFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      Papa.parse(reader.result, {
        header: true,
        skipEmptyLines: false,
        dynamicTyping: false,
        complete: (result) => resolve({ file, result }),
        error: reject,
      });
    };
    reader.onerror = reject;
    reader.readAsText(file, "UTF-8");
  });

export const groupOrdersByName = (rows) => {
  const orderGroups = {};
  rows.forEach((row) => {
    const orderName = row["Name"];
    if (!orderName) return;
    if (!orderGroups[orderName]) orderGroups[orderName] = [];
    orderGroups[orderName].push(row);
  });
  return orderGroups;
};

export const classifyOrderSource = (motherRow) => {
  if (!motherRow) return null;
  const rawTag = (motherRow["Tags"] || "").toString();
  if (rawTag.includes("宅配")) return "宅配";
  if (rawTag.includes("全家")) return "全家";
  if (rawTag.includes("7-11") || rawTag.includes("711")) return "7-11";
  return null;
};
