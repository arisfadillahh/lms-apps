import WhatsAppClient from './WhatsAppClient';
import PageHead from '@/components/admin/PageHead';

export default function AdminWhatsAppPage() {
  return (
    <div className="col gap-4">
      <PageHead
        title="WhatsApp Server"
        desc="Monitor koneksi, log pengiriman, dan reminder otomatis langsung dari satu panel."
      />
      <WhatsAppClient />
    </div>
  );
}
