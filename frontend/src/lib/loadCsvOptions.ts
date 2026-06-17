export type CsvType = "schools" | "countries";

const optionsCache = new Map<string, Promise<string[]>>();

function parseLine(line: string): string {
  const trimmed = line.trim().replace(/^\uFEFF/, "");
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).replace(/""/g, "\"").trim();
  }
  return trimmed;
}

function parseSchoolsCsv(csvText: string): string[] {
  const options = csvText
    .split(/\r?\n/)
    .map(parseLine)
    .filter(Boolean)
    .filter((value) => !value.startsWith("#"))
    .filter((value) => value.toLowerCase() !== "school")
    .filter((value) => !value.toLowerCase().startsWith("below is a list of all schools"));

  return [...new Set(options)];
}

function parseCountriesCsv(csvText: string): string[] {
  // ISO-3166 CSV: first column is "name", rest are codes/regions
  const options = csvText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim().replace(/^\uFEFF/, "");
      // Extract first column, handling quoted values
      if (trimmed.startsWith("\"")) {
        const end = trimmed.indexOf("\"", 1);
        return trimmed.slice(1, end).trim();
      }
      return trimmed.split(",")[0].trim();
    })
    .filter(Boolean)
    .filter((value) => value.toLowerCase() !== "name");

  return [...new Set(options)];
}

async function fetchCsvOptions(url: string, csvType: CsvType): Promise<string[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load CSV options from ${url}`);
  }

  const csvText = await response.text();
  return csvType === "countries" ? parseCountriesCsv(csvText) : parseSchoolsCsv(csvText);
}

export function loadCsvOptions(url: string, csvType: CsvType = "schools"): Promise<string[]> {
  const cacheKey = `${csvType}:${url}`;
  const existingPromise = optionsCache.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const optionsPromise = fetchCsvOptions(url, csvType).catch((error) => {
    optionsCache.delete(cacheKey);
    throw error;
  });
  optionsCache.set(cacheKey, optionsPromise);
  return optionsPromise;
}
