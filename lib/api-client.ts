import { toast } from "sonner";

let isRedirecting = false;

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && typeof window !== "undefined" && !isRedirecting) {
    isRedirecting = true;
    localStorage.removeItem("authToken");
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/auth/signin?redirect=${redirect}`;
    return res;
  }

  const method = (options.method ?? "GET").toUpperCase();
  const isMutation = ["POST", "PATCH", "DELETE"].includes(method);

  if (isMutation) {
    const body = await res.clone().json().catch(() => ({}));
    if (res.ok) {
      if (body.message) toast.success(body.message);
    } else {
      if (body.error_message) console.error(body.error_message);
      toast.error(body.message || "Something went wrong");
    }
  }

  return res;
}
