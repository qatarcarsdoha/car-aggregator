"use client";

import { FilterSelect } from "./FilterSelect";

export function MakeFilter({
  value,
  makes,
}: {
  value: string | null;
  makes: string[];
}) {
  return (
    <FilterSelect
      paramName="make"
      label="Make"
      ariaLabel="Filter by make"
      allLabel="All makes"
      value={value}
      options={makes}
      clearParams={["model"]}
    />
  );
}
