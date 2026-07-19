export function readBoundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const configured = process.env[name]?.trim();
  if (!configured) return fallback;

  const value = Number(configured);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  return value;
}

export function readBoolean(name: string, fallback: boolean) {
  const configured = process.env[name]?.trim().toLowerCase();
  if (!configured) return fallback;
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

export function parseEnvironmentList(value: string | undefined) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readPositiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
