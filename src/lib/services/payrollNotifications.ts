import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { createNotification, type NotificationDeliveryOptions } from '@/lib/dao/notificationsDao';
import { canAccessMenu } from '@/lib/permissions';

export async function createPayrollAdminNotifications(input: NotificationDeliveryOptions & { title: string; message: string; type?: string }) {
  const { data, error } = await getSupabaseAdmin().from('users').select('id,username,admin_permissions').eq('role', 'ADMIN').eq('is_active', true);
  if (error) throw new Error('Gagal mencari admin penggajian.');
  const admins = (data ?? []).filter(a => canAccessMenu(a.username, a.admin_permissions, 'payroll'));
  for (const admin of admins) await createNotification(admin.id, input.title, input.message, input.type ?? 'PAYROLL', { ...input, push: input.push ?? true });
  return admins.length;
}
