type AppErrorDetailPrimitive = string | number | boolean | null;

export type AppErrorDetails =
  | AppErrorDetailPrimitive
  | AppErrorDetailPrimitive[]
  | { [key: string]: AppErrorDetailPrimitive | AppErrorDetailPrimitive[] };
