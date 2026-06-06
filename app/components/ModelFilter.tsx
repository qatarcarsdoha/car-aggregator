"use client";

import { FilterSelect } from "./FilterSelect";

export function ModelFilter({
  value,
  models,
  disabled,
}: {
  value: string | null;
  models: string[];
  disabled?: boolean;
}) {
  return (
    <FilterSelect
      paramName="model"
      label="Model"
      ariaLabel="Filter by model"
      allLabel="All models"
      value={value}
      options={models}
      disabled={disabled}
    />
  );
}
