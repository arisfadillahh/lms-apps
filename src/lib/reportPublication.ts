export type ReportWhatsappStatus = 'SENT' | 'FAILED' | 'SKIPPED_POLICY' | 'SKIPPED_NO_PHONE';

type ReportPublicationDependencies = {
  shouldSendWhatsapp: boolean;
  hasParentPhone: boolean;
  now: () => string;
  publish: (delivery: { sent_via_whatsapp: boolean; sent_at: string | null }) => Promise<void>;
  notifyCoder: () => Promise<void>;
  createWhatsappLog: () => Promise<{ id: string }>;
  sendWhatsapp: () => Promise<{ success: boolean; error?: string }>;
  updateWhatsappLog: (id: string, status: 'SENT' | 'FAILED', response: unknown) => Promise<void>;
};

/**
 * Publication is authoritative and happens before best-effort external delivery.
 * This keeps the report and Coder PWA available even when school policy blocks WA
 * or the provider is unavailable, and prevents a false sent flag.
 */
export async function publishReportWithOptionalWhatsapp(
  dependencies: ReportPublicationDependencies,
): Promise<{ whatsappStatus: ReportWhatsappStatus; sentAt: string | null; warning?: string }> {
  await dependencies.publish({ sent_via_whatsapp: false, sent_at: null });
  await dependencies.notifyCoder();

  if (!dependencies.shouldSendWhatsapp) {
    return { whatsappStatus: 'SKIPPED_POLICY', sentAt: null };
  }
  if (!dependencies.hasParentPhone) {
    return { whatsappStatus: 'SKIPPED_NO_PHONE', sentAt: null };
  }

  const log = await dependencies.createWhatsappLog();
  try {
    const response = await dependencies.sendWhatsapp();
    if (!response.success) {
      const warning = response.error || 'Layanan WhatsApp menolak pengiriman';
      await dependencies.updateWhatsappLog(log.id, 'FAILED', { message: warning });
      return { whatsappStatus: 'FAILED', sentAt: null, warning };
    }

    const sentAt = dependencies.now();
    await dependencies.publish({ sent_via_whatsapp: true, sent_at: sentAt });
    await dependencies.updateWhatsappLog(log.id, 'SENT', response);
    return { whatsappStatus: 'SENT', sentAt };
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Gagal mengirim WhatsApp';
    await dependencies.updateWhatsappLog(log.id, 'FAILED', { message: warning });
    return { whatsappStatus: 'FAILED', sentAt: null, warning };
  }
}
