// Holiday funnel revision: canonical registration IDs and attribution.
(() => {
  const dialog = document.querySelector('#registration-dialog');
  const form = dialog.querySelector('#holiday-registration');
  const byId = id => dialog.querySelector('#' + id);
  const schedule = byId('registration-schedule');
  const contact = byId('registration-contact');
  const result = byId('registration-result');
  const grade = byId('registration-grade');
  const programRows = byId('registration-programs');
  const platformField = byId('registration-platform');
  const bundleOffer = byId('registration-bundle');
  const step = byId('registration-step');
  const status = byId('registration-status');
  const error = byId('registration-error');
  const submit = byId('registration-submit');
  const money = amount => 'Rp' + amount.toLocaleString('id-ID');
  const blank = () => ({ program: '', batch: '' });
  let catalogue;
  let catalogueRequest;
  let defaultBatch = '';
  let selections = [blank()];
  let registrationId;
  let submitting = false;

  function loadCatalogue() {
    catalogueRequest ??= fetch('/api/holiday-class/registration', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Jadwal belum dapat dimuat.');
        return response.json();
      }).catch(error => {
        catalogueRequest = null;
        throw error;
      });
    return catalogueRequest;
  }

  function tellError(message = '') {
    error.textContent = message;
    error.hidden = !message;
  }

  function currentLevel() {
    return catalogue.levels.find(item => +grade.value >= item.minGrade && +grade.value <= item.maxGrade);
  }

  function levelLabel(number) {
    return 'Kelas ' + number + (number <= 6 ? ' SD' : number <= 9 ? ' SMP' : ' SMA');
  }

  function pickGrade() {
    const preferred = selections[0].batch || defaultBatch;
    selections = [{ program: '', batch: preferred }];
    tellError();
    renderChoices();
  }

  function scheduleFor(level, programId, batchId) {
    const program = level.programs[programId];
    const batch = catalogue.batches[batchId];
    if (!program || !batch) return null;
    return { ...batch, name: program[0], time: program[+batchId + 1] };
  }

  function startMinutes(time) {
    const [hours, minutes] = time.split('.').map(Number);
    return hours * 60 + minutes;
  }

  function overlaps(a, b) {
    return a.start <= b.end && b.start <= a.end
      && Math.abs(startMinutes(a.time) - startMinutes(b.time)) < catalogue.sessionMinutes;
  }

  function batchIssue(level, index, batchId) {
    const candidate = scheduleFor(level, selections[index].program, batchId);
    if (!candidate) return '';
    if (new Date(candidate.start + 'T' + candidate.time.replace('.', ':') + ':00+07:00') <= new Date()) {
      return 'Batch sudah dimulai';
    }
    for (const [position, choice] of selections.entries()) {
      if (position === index) continue;
      const chosen = scheduleFor(level, choice.program, choice.batch);
      if (chosen && overlaps(candidate, chosen)) return 'Bentrok dengan ' + chosen.name;
    }
    return '';
  }

  function renderChoices(focusName) {
    const level = currentLevel();
    programRows.replaceChildren();
    if (!level) {
      platformField.hidden = bundleOffer.hidden = true;
      byId('registration-estimate').textContent = '—';
      return;
    }

    selections.forEach((selection, index) => {
      const row = document.createElement('div');
      row.className = 'registration-choice-row';
      const program = document.createElement('select');
      program.name = 'program-' + index;
      program.required = true;
      program.add(new Option('Pilih program', ''));
      level.programs.forEach(([name], id) => {
        const option = new Option(name, id);
        option.disabled = selections.some((choice, position) => position !== index && choice.program === String(id));
        program.add(option);
      });
      program.value = selection.program;
      const batch = document.createElement('select');
      batch.name = 'batch-' + index;
      batch.required = true;
      batch.disabled = selection.program === '';
      batch.add(new Option('Pilih tanggal dan jam', ''));
      if (!batch.disabled) {
        const [, ...times] = level.programs[selection.program];
        catalogue.batches.forEach((item, id) => {
          const issue = batchIssue(level, index, id);
          const suffix = issue.startsWith('Bentrok') ? ' · Bentrok' : issue ? ' · Sudah dimulai' : '';
          const option = new Option(item.label + ' · ' + times[id] + ' WIB' + suffix, id);
          option.disabled = Boolean(issue);
          if (issue) option.title = issue;
          batch.add(option);
        });
      }
      batch.value = selection.batch;
      if (batch.selectedOptions[0]?.disabled) batch.value = '';
      program.addEventListener('change', () => {
        selection.program = program.value;
        const issue = batchIssue(level, index, selection.batch);
        if (issue) selection.batch = '';
        tellError(issue && issue + '. Pilih batch lain untuk ' + level.programs[program.value][0] + '.');
        renderChoices(issue ? batch.name : program.name);
      });
      batch.addEventListener('change', () => {
        const issue = batchIssue(level, index, batch.value);
        selection.batch = issue ? '' : batch.value;
        tellError(issue && issue + '. Pilih batch lain.');
        renderChoices(batch.name);
      });
      const programLabel = document.createElement('label');
      const batchLabel = document.createElement('label');
      const suffix = selections.length === 3 ? ' ' + (index + 1) : '';
      program.setAttribute('aria-label', 'Program' + suffix);
      batch.setAttribute('aria-label', 'Batch' + suffix);
      programLabel.append('Program' + suffix, program);
      batchLabel.append('Batch' + suffix, batch);
      row.append(programLabel, batchLabel);
      programRows.append(row);
    });

    const hasGodot = selections.some(choice => choice.program !== '' && level.programs[choice.program]?.[0] === 'Vibe Coding Godot + MCP');
    platformField.hidden = !hasGodot;
    for (const input of platformField.querySelectorAll('input')) {
      input.required = hasGodot;
      if (!hasGodot) input.checked = false;
    }
    bundleOffer.hidden = selections.length === 1 && !selections[0].program;
    const bundle = selections.length === 3;
    byId('bundle-headline').textContent = bundle ? 'Bundling 3 program' : 'Hemat ' + money(level.price * 3 - level.bundle) + ' dengan bundling';
    byId('bundle-detail').textContent = bundle ? 'Pilih tiga program berbeda dalam jenjang yang sama.' : 'Tambah 2 program. Total bundling ' + money(level.bundle) + '.';
    byId('bundle-toggle').textContent = bundle ? 'Pilih 1 program' : 'Tambah 2 program';
    updateTotal();
    if (focusName) form.elements.namedItem(focusName)?.focus({ preventScroll: true });
  }

  function platformChoice() {
    return platformField.hidden ? 'none' : form.elements.platform.value;
  }

  function updateTotal() {
    const level = currentLevel();
    const platform = platformChoice() === 'clevio' ? catalogue.platformFee : 0;
    const amount = (selections.length === 3 ? level.bundle : level.price) + platform;
    byId('registration-estimate').textContent = money(amount);
    byId('registration-total').textContent = money(amount);
  }

  function showSchedule() {
    schedule.hidden = false;
    contact.hidden = true;
    step.textContent = '1 dari 2 · Pilih kelas dan jadwal';
    tellError();
  }

  function chosenSchedules() {
    const level = currentLevel();
    return selections.map(choice => scheduleFor(level, choice.program, choice.batch));
  }

  byId('registration-next').addEventListener('click', () => {
    tellError();
    for (const field of schedule.querySelectorAll('select, input:required')) {
      if (!field.reportValidity()) return;
    }
    const choices = chosenSchedules();
    for (const [index, current] of choices.entries()) {
      const clash = choices.slice(0, index).find(other => overlaps(current, other));
      if (clash) {
        tellError(current.name + ' bentrok dengan ' + clash.name + '. Pilih batch lain.');
        return;
      }
    }
    const summary = byId('registration-summary-items');
    const lines = choices.map(choice => choice.name + ' · ' + choice.label + ' · ' + choice.time + ' WIB');
    if (platformChoice() === 'clevio') lines.push('Platform Open Code · ' + money(catalogue.platformFee));
    if (platformChoice() === 'own') lines.push('Platform Open Code · disiapkan sendiri');
    summary.replaceChildren(...lines.map(line => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    }));
    schedule.hidden = true;
    contact.hidden = false;
    step.textContent = '2 dari 2 · Data peserta dan pembayaran';
    dialog.scrollTop = 0;
    form.elements.studentName.focus({ preventScroll: true });
  });

  byId('registration-back').addEventListener('click', () => {
    showSchedule();
    grade.focus();
  });
  byId('bundle-toggle').addEventListener('click', () => {
    const expanding = selections.length === 1;
    selections = expanding ? [selections[0], blank(), blank()] : [selections[0]];
    tellError();
    renderChoices(expanding ? 'program-1' : 'program-0');
  });
  platformField.addEventListener('change', updateTotal);
  grade.addEventListener('change', pickGrade);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (contact.hidden || submitting) return;
    submitting = true;
    submit.disabled = true;
    submit.textContent = 'Membuat invoice…';
    registrationId ??= crypto.randomUUID();
    tellError();
    let adMeasurement = false;
    try { adMeasurement = localStorage.getItem('clevio-holiday-analytics') !== 'no'; } catch {}
    try {
      const response = await fetch('/api/holiday-class/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: registrationId,
          parentName: form.elements.parentName.value,
          studentName: form.elements.studentName.value,
          phone: form.elements.phone.value,
          schoolGrade: +grade.value,
          selections: selections.map(choice => ({ program: +choice.program, batch: +choice.batch })),
          platform: platformChoice(),
          consent: form.elements.consent.checked,
          adMeasurement,
          attribution: window.clevioHolidayAttribution?.() || {},
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pendaftaran belum dapat diproses.');
      const invoice = new URL(data.invoiceUrl, location.origin);
      if (invoice.origin !== location.origin || !invoice.pathname.startsWith('/invoice/')) throw new Error('Link invoice belum tersedia.');
      byId('registration-invoice-number').textContent = data.invoiceNumber;
      byId('registration-invoice-link').href = invoice.href;
      form.hidden = true;
      result.hidden = false;
      step.textContent = 'Pendaftaran tercatat';
      if (adMeasurement && data.eventId) {
        try {
          sessionStorage.setItem(`clevio-holiday-registration:${invoice.pathname}`, data.eventId);
        } catch {
          document.dispatchEvent(new CustomEvent('clevio:holiday-class', {
            detail: { name: 'registration_completed', eventId: data.eventId },
          }));
        }
        const delivered=await window.clevioTrackHolidayRegistration?.(data.eventId);
        if(delivered)try{sessionStorage.removeItem(`clevio-holiday-registration:${invoice.pathname}`);}catch{}
      }
      if(data.reused) {
        step.textContent='Pesanan yang sama sudah tercatat';
        byId('registration-invoice-link').textContent='Lanjut ke invoice sebelumnya';
        byId('registration-reuse-edit').hidden=false;
        return;
      }
      location.assign(invoice.href);
    } catch (failure) {
      tellError(failure instanceof Error ? failure.message : 'Coba lagi dengan data yang sama.');
    } finally {
      submitting = false;
      submit.disabled = false;
      submit.textContent = 'Daftar';
    }
  });

  dialog.addEventListener('cancel', event => { if (submitting) event.preventDefault(); });
  byId('registration-reuse-edit').addEventListener('click',()=>{
    registrationId=undefined;
    result.hidden=true;
    form.hidden=false;
    byId('registration-reuse-edit').hidden=true;
    showSchedule();
  });
  dialog.querySelector('.close-dialog').addEventListener('click', event => { if (submitting) event.preventDefault(); });
  document.querySelectorAll('[data-holiday-register]').forEach(button => {
    button.addEventListener('click', async () => {
      let preferredGrade;
      if (button.dataset.holidayRegister === 'schedule') {
        const level = document.querySelector('#level').value;
        defaultBatch = document.querySelector('#batch').value;
        preferredGrade = +level;
        document.querySelector('#schedule-dialog').close();
      }
      dialog.showModal();
      if (!result.hidden || !form.hidden) return;
      status.textContent = 'Memuat pilihan kelas…';
      tellError();
      try {
        catalogue = await loadCatalogue();
        grade.replaceChildren(new Option('Pilih kelas sekolah', ''));
        for (let number = 1; number <= 12; number += 1) grade.add(new Option(levelLabel(number), number));
        if (preferredGrade !== undefined) {
          const suggested = catalogue.levels[preferredGrade];
          for (const option of grade.options) {
            if (+option.value >= suggested.minGrade && +option.value <= suggested.maxGrade) option.text += ' · ' + suggested.name;
          }
        }
        status.textContent = '';
        form.hidden = false;
        renderChoices();
      } catch {
        status.textContent = '';
        tellError('Jadwal belum dapat dimuat. Tutup formulir lalu coba lagi.');
      }
    });
  });
})();
