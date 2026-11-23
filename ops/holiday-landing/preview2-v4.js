const batches = ['14–16 Des', '17–19 Des', '21–23 Des', '24–26 Des', '28–30 Des', '4–6 Jan', '7–9 Jan'];
const levels = [
  { name: 'Explorer', grade: 'Kelas 1–3 SD', price: 350000, bundle: 900000, programs: [
    ['Scratch Jr.', '09.00', '13.00', '11.30', '11.30', '09.00', '09.00', '09.00'],
    ['Kodu', '09.00', '09.00', '11.30', '10.00', '09.00', '11.30', '09.00'],
    ['Minecraft Builder', '11.30', '10.00', '13.00', '09.00', '09.00', '13.00', '09.00'],
  ] },
  { name: 'Creator', grade: 'Kelas 4–6 SD', price: 425000, bundle: 1100000, programs: [
    ['MakeCode', '11.30', '11.30', '13.00', '09.00', '09.00', '13.00', '09.00'],
    ['GDevelop', '14.00', '13.00', '13.00', '14.00', '11.30', '09.00', '09.00'],
    ['Minecraft Code', '14.00', '14.00', '13.00', '09.00', '11.30', '11.30', '09.00'],
    ['Scratch 3', '09.00', '13.00', '09.00', '09.00', '14.00', '13.00', '14.00'],
  ] },
  { name: 'Innovator', grade: 'Kelas 7 SMP–12 SMA', price: 500000, bundle: 1300000, programs: [
    ['Vibe Coding Godot + MCP', '09.00', '13.00', '09.00', '09.00', '14.00', '13.00', '11.30'],
    ['n8n Automation', '09.00', '13.00', '14.00', '09.00', '09.00', '14.00', '09.00'],
    ['Vibes Coding (VS Code)', '09.00', '13.00', '14.00', '09.00', '09.00', '14.00', '10.00'],
  ] },
];
const money = (amount) => 'Rp' + amount.toLocaleString('id-ID');

const gallery = [
  [
    ['Scratch Jr.', 'Teman Baru di Sekolah', 'Cerita interaktif dengan karakter dan dialog.', 'scratch-jr-teman-baru-sekolah'],
    ['Kodu', 'Misi Daur Ulang', 'Jelajahi arena 3D dan kumpulkan benda untuk didaur ulang.', 'kodu-daur-ulang'],
    ['Kodu', 'Pahlawan Pemadam Kebakaran', 'Arena 3D dengan misi pemadaman api.', 'kodu-pahlawan-pemadam-kebakaran'],
    ['Minecraft Builder', 'Taman Untuk Semua', 'Dunia Minecraft yang dibangun sesuai tema.', 'minecraft-builder-taman-untuk-semua'],
  ],
  [
    ['MakeCode', 'Gempa! Siap Siaga', 'Prototipe micro:bit untuk belajar sensor dan merancang respons darurat.', 'microbit-gempa-siap-siaga'],
    ['GDevelop', 'Old Platformer', 'Game lompat rintangan dan kumpulkan koin.', 'gdevelop-platformer', 'https://gdevelop.io/en-gb/game-example/free/old-platformer'],
    ['Minecraft Code', 'Kota Hijau Masa Depan', 'Bangun solusi untuk kota dengan coding di Minecraft.', 'minecraft-coder-kota-hijau-masa-depan'],
    ['Scratch 3', 'Pong Starter', 'Game memantulkan bola dengan pengendali sederhana.', 'scratch-pong', 'https://scratch.mit.edu/projects/10128515/'],
  ],
  [
    ['Vibe Coding Godot + MCP', 'Dodge the Creeps!', 'Game 2D dari tutorial Godot. Gerakkan karakter dan hindari musuh.', 'godot-dodge-the-creeps', 'https://docs.godotengine.org/en/stable/getting_started/first_2d_game/'],
    ['n8n Automation', 'Teman Belajar', 'Alur otomasi untuk membantu kegiatan belajar.', 'n8n-automation-teman-belajar'],
    ['n8n Automation', 'Jadwal Sekolah Otomatis', 'Otomasi yang mengirim jadwal pelajaran harian ke Telegram.', 'n8n-jadwal-sekolah-otomatis'],
    ['Vibes Coding (VS Code)', 'Suara Pelajar', 'Contoh aplikasi yang dikembangkan lewat proses vibe coding.', 'vibe-coding-suara-pelajar'],
  ],
];

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}
function projectImage(project, thumbnail = false) {
  const image = element('img');
  const folder = thumbnail ? 'assets' : 'projects';
  image.src = './' + folder + '/' + project[3] + '.webp';
  image.alt = thumbnail ? '' : project[1];
  image.loading = 'lazy';
  return image;
}
function campaignEvent(name) {
  document.dispatchEvent(new CustomEvent('clevio:holiday-class', { detail: { name } }));
}

const programCards = [
  {
    symbol: 'game',
    description: 'Kenalan dengan logika, kreativitas, dan dunia game dengan cara yang menyenangkan.',
    tools: ['scratchjr', 'kodu', 'minecraft-education'],
  },
  {
    symbol: 'code',
    description: 'Bikin game dan proyek interaktif sambil memperdalam keterampilan coding.',
    tools: ['makecode', 'gdevelop', 'minecraft-education', 'scratch'],
  },
  {
    symbol: 'chip',
    description: 'Eksplorasi proyek yang lebih menantang, dari game 3D hingga otomasi AI.',
    tools: ['godot', 'n8n', 'vscode'],
  },
];

const level = document.querySelector('#level');
const batch = document.querySelector('#batch');
const batchButtons = document.querySelector('#batch-buttons');
const programs = document.querySelector('#programs');
const scheduleDialog = document.querySelector('#schedule-dialog');
const projectDialog = document.querySelector('#project-dialog');
const projectTabs = document.querySelector('#project-tabs');
const projectCards = document.querySelector('#project-cards');
let selectedProjectLevel = 0;

function icon(name) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  const use = document.createElementNS(namespace, 'use');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', '#' + name);
  svg.append(use);
  return svg;
}

function openSchedule(batchIndex) {
  batch.value = batchIndex;
  renderSchedule();
  scheduleDialog.showModal();
  campaignEvent('view_schedule');
}

function renderSchedule() {
  const group = levels[level.value];
  programs.replaceChildren(...group.programs.map(([name, ...hours]) => {
    const row = element('li');
    row.append(element('strong', name), element('span', hours[batch.value] + ' WIB'));
    return row;
  }));
}

function renderProjects(index) {
  selectedProjectLevel = index;
  for (const [position, button] of [...projectTabs.children].entries()) {
    button.setAttribute('aria-pressed', String(position === index));
  }
  document.querySelector('#project-grade').textContent = 'Contoh proyek ' + levels[index].name;
  projectCards.replaceChildren(...gallery[index].map(project => {
    const card = element('article', '', 'project-card');
    const copy = element('div');
    copy.append(element('span', project[0], 'project-kind'), element('h4', project[1]), element('p', project[2]));
    if (project[4]) {
      const source = element('a', 'Sumber demo ↗', 'project-source');
      source.href = project[4];
      source.target = '_blank';
      source.rel = 'noopener';
      copy.append(source);
    }
    card.append(projectImage(project), copy);
    return card;
  }));
}

function showProjects(index) {
  renderProjects(index);
  projectDialog.showModal();
  campaignEvent('view_projects');
}

function renderProgramCard(item, index) {
  const data = programCards[index];
  const card = element('article', '', 'level-card');
  card.dataset.level = index;
  const header = element('header', '', 'level-head');
  const mark = element('span', '', 'icon-tile');
  mark.append(icon(data.symbol));
  const label = element('div');
  label.append(element('h3', item.name), element('span', item.grade, 'grade'));
  header.append(mark, label);

  const cover = element('button', '', 'project-cover');
  cover.type = 'button';
  cover.setAttribute('aria-label', 'Buka galeri ' + item.name);
  cover.setAttribute('aria-haspopup', 'dialog');
  for (const [name] of item.programs) {
    const project = gallery[index].find(entry => entry[0] === name);
    if (project) cover.append(projectImage(project, true));
  }
  const play = element('span', '', 'cover-play');
  play.append(icon('play'));
  cover.append(play);
  cover.addEventListener('click', () => showProjects(index));

  const list = element('ul', '', 'program-list');
  item.programs.forEach(([name], position) => {
    const row = element('li');
    const logo = element('img', '', 'software-logo');
    const logoName = data.tools[position];
    logo.src = './assets/software/' + logoName + '.webp';
    if (logoName === 'minecraft-education') logo.classList.add('software-logo-wordmark');
    logo.alt = '';
    logo.width = 36;
    logo.height = 30;
    logo.loading = 'lazy';
    row.append(logo, element('span', name));
    list.append(row);
  });

  const open = element('button', 'Lihat contoh proyek', 'preview-button');
  open.append(icon('arrow'));
  open.type = 'button';
  open.setAttribute('aria-haspopup', 'dialog');
  open.setAttribute('aria-label', 'Lihat contoh proyek ' + item.name);
  open.addEventListener('click', () => showProjects(index));
  card.append(header, element('p', data.description, 'level-description'), cover, list, open);
  document.querySelector('#level-cards').append(card);
}

function renderPriceRow(item, index) {
  const row = element('tr');
  row.dataset.level = index;
  const name = element('th');
  name.scope = 'row';
  const identity = element('div', '', 'price-name');
  const symbol = element('span', '', 'icon-tile');
  symbol.append(icon(programCards[index].symbol));
  const label = element('span');
  label.append(element('strong', item.name), element('small', item.grade));
  identity.append(symbol, label);
  name.append(identity);
  row.append(name, element('td', money(item.price)), element('td', money(item.bundle)));
  document.querySelector('#price-rows').append(row);
}

levels.forEach((item, index) => {
  level.add(new Option(item.name + ' · ' + item.grade, index));
  renderProgramCard(item, index);
  renderPriceRow(item, index);
  const tab = element('button', item.grade);
  tab.type = 'button';
  tab.dataset.level = index;
  tab.addEventListener('click', () => renderProjects(index));
  projectTabs.append(tab);
});

batches.forEach((date, index) => {
  batch.add(new Option('Batch ' + (index + 1) + ' · ' + date, index));
  const button = element('button', '', 'batch-button');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'schedule-dialog');
  button.setAttribute('aria-label', 'Batch ' + (index + 1) + ', ' + date);
  button.append(icon('calendar'), element('span', date));
  button.addEventListener('click', () => openSchedule(index));
  batchButtons.append(button);
});
level.addEventListener('change', renderSchedule);
batch.addEventListener('change', renderSchedule);
document.querySelector('#pick-level').addEventListener('click', () => {
  level.value = selectedProjectLevel;
  projectDialog.close();
  openSchedule(batch.value);
});
for (const dialog of [projectDialog, scheduleDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
document.querySelectorAll('a[href="#jadwal"]').forEach(link => link.addEventListener('click', () => campaignEvent('view_schedule')));
document.querySelectorAll('a[href="https://clev.io/chat"]').forEach(link => link.addEventListener('click', () => campaignEvent('whatsapp_click')));
