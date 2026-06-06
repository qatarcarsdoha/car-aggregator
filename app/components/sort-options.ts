export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price_asc", label: "Price — low to high" },
  { value: "price_desc", label: "Price — high to low" },
  { value: "mileage_asc", label: "Mileage — low to high" },
  { value: "year_desc", label: "Year — newest model" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
