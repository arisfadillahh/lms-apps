-- Sample software data for the LMS
-- Run AFTER supabase_schema.sql and supabase_sample_data.sql

-- Insert Software entries
INSERT INTO software (id, name, description, version, installation_url, installation_instructions, minimum_specs, access_info)
VALUES
  (
    'a1b2c3d4-1111-4444-aaaa-111111111111',
    'Scratch Online',
    'Platform visual programming berbasis blok untuk pemula. Dapat digunakan langsung di browser tanpa instalasi.',
    '3.0',
    'https://scratch.mit.edu/',
    'Tidak perlu instalasi. Langsung buka scratch.mit.edu dan login dengan akun yang sudah didaftarkan.',
    '{"browser": "Chrome/Firefox/Edge terbaru", "ram": "2 GB", "internet": "Koneksi stabil"}',
    'Login menggunakan akun Clevio yang sudah didaftarkan oleh admin. Username: nama_coder@clevio.id'
  ),
  (
    'a1b2c3d4-2222-4444-aaaa-222222222222',
    'GDevelop',
    'Game engine tanpa coding untuk membuat game 2D dan platformer. Tersedia versi web dan desktop.',
    '5.3',
    'https://gdevelop.io/download',
    '1. Buka gdevelop.io/download
2. Pilih versi sesuai OS (Windows/Mac/Linux)
3. Download dan install
4. Atau gunakan versi web di editor.gdevelop.io',
    '{"os": "Windows 10/11, macOS 10.13+, atau Linux", "ram": "4 GB", "storage": "500 MB", "graphics": "GPU dengan OpenGL 3.0+"}',
    'Buat akun gratis di gdevelop.io untuk menyimpan proyek ke cloud.'
  ),
  (
    'a1b2c3d4-3333-4444-aaaa-333333333333',
    'Canva',
    'Platform desain grafis online untuk membuat presentasi, poster, dan aset visual.',
    NULL,
    'https://www.canva.com/',
    'Tidak perlu instalasi. Buka canva.com dan login dengan akun yang sudah disediakan.',
    '{"browser": "Chrome/Firefox/Safari/Edge terbaru", "ram": "2 GB", "internet": "Koneksi stabil"}',
    'Login menggunakan akun Google sekolah (@clevio.id). Akses Canva Pro sudah aktif untuk semua coder.'
  ),
  (
    'a1b2c3d4-4444-4444-aaaa-444444444444',
    'Minecraft Education',
    'Versi Minecraft khusus untuk pendidikan dengan fitur coding menggunakan MakeCode dan Python.',
    '1.20',
    'https://education.minecraft.net/get-started/download',
    '1. Buka education.minecraft.net/get-started/download
2. Download installer untuk Windows atau Mac
3. Install dan login dengan akun Microsoft sekolah
4. Pastikan license sudah aktif',
    '{"os": "Windows 10/11 atau macOS 10.14+", "ram": "8 GB (disarankan)", "storage": "1 GB", "cpu": "Intel Core i5 atau setara"}',
    'Login dengan akun Microsoft sekolah (@clevio.id). Jika muncul error license, hubungi admin.'
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  installation_url = EXCLUDED.installation_url,
  installation_instructions = EXCLUDED.installation_instructions,
  minimum_specs = EXCLUDED.minimum_specs,
  access_info = EXCLUDED.access_info;

-- Link software to blocks
-- Xplorer blocks use Scratch Online
INSERT INTO block_software (block_id, software_id)
SELECT b.id, 'a1b2c3d4-1111-4444-aaaa-111111111111'
FROM blocks b
JOIN levels l ON b.level_id = l.id
WHERE l.name = 'Xplorer'
ON CONFLICT (block_id, software_id) DO NOTHING;

-- Creator blocks use GDevelop and Canva
INSERT INTO block_software (block_id, software_id)
SELECT b.id, 'a1b2c3d4-2222-4444-aaaa-222222222222'
FROM blocks b
JOIN levels l ON b.level_id = l.id
WHERE l.name = 'Creator'
ON CONFLICT (block_id, software_id) DO NOTHING;

INSERT INTO block_software (block_id, software_id)
SELECT b.id, 'a1b2c3d4-3333-4444-aaaa-333333333333'
FROM blocks b
JOIN levels l ON b.level_id = l.id
WHERE l.name = 'Creator'
ON CONFLICT (block_id, software_id) DO NOTHING;

-- Innovator blocks use Minecraft Education and GDevelop
INSERT INTO block_software (block_id, software_id)
SELECT b.id, 'a1b2c3d4-4444-4444-aaaa-444444444444'
FROM blocks b
JOIN levels l ON b.level_id = l.id
WHERE l.name = 'Innovator'
ON CONFLICT (block_id, software_id) DO NOTHING;

INSERT INTO block_software (block_id, software_id)
SELECT b.id, 'a1b2c3d4-2222-4444-aaaa-222222222222'
FROM blocks b
JOIN levels l ON b.level_id = l.id
WHERE l.name = 'Innovator'
ON CONFLICT (block_id, software_id) DO NOTHING;

-- Summary output
SELECT 
  'Software seeded: ' || (SELECT COUNT(*) FROM software) as software_count,
  'Block-software links: ' || (SELECT COUNT(*) FROM block_software) as link_count;
