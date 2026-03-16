import type { CustomerInfo } from '../types';

type AddCustomerPayload = {
  fname: string;
  mname: string | null;
  lname: string;
  email: string;
  c_num: string;
  latitude: number | null;
  longitude: number | null;
  street: string | null;
  municipality: string | null;
  province: string | null;
  postal: string | null;
  role_ID: number | null;
};

export type AddCustomerResponse = Record<string, unknown>;

function getApiBaseUrl(): string {
  const fromEnv = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  return (fromEnv ?? '').replace(/\/+$/, '');
}

function getFnameMnameLname(customer: CustomerInfo): { fname: string; mname: string | null; lname: string } {
  if ((customer.fname ?? '').trim() && (customer.lname ?? '').trim()) {
    return {
      fname: (customer.fname ?? '').trim(),
      mname: customer.mname?.trim() || null,
      lname: (customer.lname ?? '').trim()
    };
  }
  const parts = (customer.fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { fname: '', mname: null, lname: '' };
  if (parts.length === 1) return { fname: parts[0], mname: null, lname: parts[0] };
  if (parts.length === 2) return { fname: parts[0], mname: null, lname: parts[1] };
  return { fname: parts[0], mname: parts.slice(1, -1).join(' '), lname: parts[parts.length - 1] };
}

export async function addCustomer(customer: CustomerInfo): Promise<AddCustomerResponse> {
  const apiBase = getApiBaseUrl();
  const { fname, mname, lname } = getFnameMnameLname(customer);

  const payload: AddCustomerPayload = {
    fname,
    mname,
    lname,
    email: customer.email ?? '',
    c_num: customer.phone ?? '',
    latitude: null,
    longitude: null,
    street: customer.address?.trim() ? customer.address.trim() : null,
    municipality: null,
    province: null,
    postal: null,
    role_ID: null
  };

  const res = await fetch(`${apiBase}/add/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    let message: string;
    if (typeof data === 'string') {
      const preMatch = data.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      message = preMatch ? preMatch[1].trim() : (data.length > 200 ? `Request failed (${res.status})` : data);
    } else if (data && typeof data === 'object' && 'message' in data && typeof (data as any).message === 'string') {
      message = (data as any).message;
    } else {
      message = `Request failed (${res.status})`;
    }
    throw new Error(message);
  }

  return data as AddCustomerResponse;
}

