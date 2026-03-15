type AnyObject = Record<string, unknown>;

function stripInternalFields(obj: AnyObject): AnyObject {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key, value]) => {
        if (key === "id") return false;
        if (key === "password") return false;
        // strip integer FK columns (e.g. taskStatusId, createdBy, taskId on join tables)
        if (key.endsWith("Id") && typeof value === "number") return false;
        if (key === "createdBy" && typeof value === "number") return false;
        return true;
      })
      .map(([key, value]) => [key, sanitize(value)])
  );
}

export function sanitize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return stripInternalFields(value as AnyObject) as T;
  }
  return value;
}
