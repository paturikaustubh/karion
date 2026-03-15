import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  message: string;
  data: T | null;
  error_message: string | null;
}

export function ok<T>(message: string, data: T, status = 200): NextResponse {
  return NextResponse.json<ApiResponse<T>>(
    { message, data, error_message: null },
    { status }
  );
}

export function err(
  message: string,
  error_message: string,
  status = 500
): NextResponse {
  return NextResponse.json<ApiResponse<null>>(
    { message, data: null, error_message },
    { status }
  );
}
