import { customType } from "drizzle-orm/pg-core";

export const vector = customType<{
  data: number[];
  driverParam: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 768})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    return (value as string)
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});
