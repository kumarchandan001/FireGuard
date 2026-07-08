/**
 * FireGuard AI — API Client
 *
 * Centralized Axios instance with base URL, interceptors,
 * and typed response helpers. All API calls go through this module.
 */

const API_BASE_URL = '/api/v1';

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/**
 * Lightweight fetch wrapper with consistent error handling.
 * Using native fetch instead of Axios to avoid the extra dependency.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message = errorBody?.errors?.[0]?.message || response.statusText;
      throw new ApiError(response.status, message, errorBody?.errors?.[0]?.code || 'UNKNOWN');
    }

    return response.json();
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Get a URL for fetching binary content (e.g., screenshots).
   */
  getResourceUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}

/**
 * Typed API error for consistent error handling.
 */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(
    status: number,
    message: string,
    code: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// Singleton API client instance
export const apiClient = new ApiClient(API_BASE_URL);
