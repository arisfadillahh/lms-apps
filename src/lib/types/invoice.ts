// Invoice System Types

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE';

export interface InvoiceSettings {
    id: string;
    generate_day: number;
    due_days: number;
    bank_name: string;
    bank_account_number: string;
    bank_account_holder: string;
    admin_whatsapp_number: string;
    base_url: string;
    invoice_message_template: string;
    updated_at: string;
}

export interface CCRNumber {
    id: string;
    parent_phone: string;
    ccr_sequence: number;
    ccr_code: string;
    parent_name: string | null;
    created_at: string;
}

export interface Invoice {
    id: string;
    invoice_number: string;
    ccr_id: string;
    parent_phone: string;
    parent_name: string;
    period_month: number;
    period_year: number;
    total_amount: number;
    status: InvoiceStatus;
    due_date: string;
    paid_at: string | null;
    paid_notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined relations
    ccr?: CCRNumber;
    items?: InvoiceItem[];
}

export interface InvoiceItem {
    id: string;
    invoice_id: string;
    coder_id: string;
    coder_name: string;
    class_name: string;
    level_name: string;
    base_price: number;
    discount_amount: number;
    final_price: number;
    payment_period_id: string | null;
    created_at: string;
}

export interface WhatsAppSession {
    id: string;
    client_id: string;
    session_data: Record<string, unknown> | null;
    is_connected: boolean;
    connected_phone: string | null;
    last_activity_at: string | null;
    created_at: string;
    updated_at: string;
}

// Request/Response types
export interface GenerateInvoicesRequest {
    month: number;
    year: number;
}

export interface GenerateInvoicesResponse {
    success: boolean;
    generated: number;
    skipped: number;
    invoices: Invoice[];
    errors: string[];
}

export interface SendRemindersRequest {
    month: number;
    year: number;
}

export interface SendRemindersResponse {
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
}

export interface MarkPaidRequest {
    paid_at: string;
    paid_notes?: string;
}

// Filter types for admin list
export interface InvoiceFilters {
    month?: number;
    year?: number;
    status?: InvoiceStatus;
    search?: string;
    page?: number;
    limit?: number;
}

export interface InvoiceListResult {
    invoices: Invoice[];
    total: number;
    page: number;
    limit: number;
}

// WhatsApp status
export interface WhatsAppStatus {
    isConnected: boolean;
    connectedPhone: string | null;
    qrCode: string | null;
    lastActivity: string | null;
}
