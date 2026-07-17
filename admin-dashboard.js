const state = { projects: [], notes: [], showArchived: false, noteSearch: '', selectedNoteId: null };
const dialog = document.querySelector('#project-dialog');
const form = document.querySelector('#project-form');
let noteSaveTimer;

function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
}

async function api(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers || {}) } });
    if (response.status === 401) { window.location.assign('/'); throw new Error('Session expired'); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || 'Something went wrong.');
    return body;
}

function render() {
    const visible = state.projects.filter((project) => state.showArchived || !project.archived).sort((a,b) => a.order - b.order);
    const active = state.projects.filter((project) => !project.archived && project.status !== 'Complete');
    document.querySelector('#active-count').textContent = active.length;
    document.querySelector('#progress-average').textContent = `${active.length ? Math.round(active.reduce((sum,p) => sum + p.progress, 0) / active.length) : 0}%`;
    document.querySelector('#empty-state').hidden = visible.length > 0;
    document.querySelector('#project-list').innerHTML = visible.map((project, index) => `
        <article class="project-card ${project.archived ? 'archived' : ''}" data-id="${project.id}">
            <div><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description || 'No description yet.')}</p><div class="meta"><span class="pill">${escapeHtml(project.status)}</span>${project.targetDate ? `<span class="pill">Target ${escapeHtml(project.targetDate)}</span>` : ''}${project.link ? `<a class="pill project-link" href="${escapeHtml(project.link)}" target="_blank" rel="noreferrer">Open project</a>` : ''}</div></div>
            <div><div class="progress-copy"><span>Progress</span><strong>${project.progress}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${project.progress}%"></div></div>${project.currentTask ? `<p class="next-step">Now: ${escapeHtml(project.currentTask)}</p>` : ''}${project.nextStep ? `<p class="next-step">Next: ${escapeHtml(project.nextStep)}</p>` : ''}</div>
            <div class="card-actions"><button data-action="up" title="Move up" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="down" title="Move down" ${index === visible.length - 1 ? 'disabled' : ''}>↓</button><button data-action="edit" title="Edit">✎</button><button data-action="archive" title="${project.archived ? 'Restore' : 'Archive'}">${project.archived ? '↩' : '×'}</button></div>
        </article>`).join('');
}

function renderNotes() {
    const query = state.noteSearch.toLowerCase();
    const notes = state.notes
        .filter((note) => !query || `${note.title} ${stripHtml(note.content)} ${note.tag}`.toLowerCase().includes(query))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
    document.querySelector('#notes-empty').hidden = notes.length > 0;
    document.querySelector('#notes-list').innerHTML = notes.map((note) => `
        <button class="note-list-item ${note.id === state.selectedNoteId ? 'active' : ''}" data-note-id="${note.id}">
            ${note.pinned ? '<span class="pin-mark">◆</span>' : ''}<strong>${escapeHtml(note.title || 'Untitled document')}</strong>
            <small>${escapeHtml(stripHtml(note.content).slice(0, 70) || note.tag || 'Empty document')}</small>
        </button>`).join('');
}

function stripHtml(value) {
    const element = document.createElement('div');
    element.innerHTML = value || '';
    return element.textContent || '';
}

function sanitiseEditorHtml(value) {
    const template = document.createElement('template');
    template.innerHTML = value;
    template.content.querySelectorAll('script,style,iframe,object,embed,img').forEach((element) => element.remove());
    template.content.querySelectorAll('*').forEach((element) => {
        [...element.attributes].forEach((attribute) => {
            if (attribute.name.startsWith('on') || attribute.name === 'style') element.removeAttribute(attribute.name);
        });
        if (element.tagName === 'A' && !/^https?:\/\//i.test(element.getAttribute('href') || '')) element.removeAttribute('href');
    });
    return template.innerHTML;
}

function openForm(project = null) {
    form.reset(); document.querySelector('#form-error').textContent = '';
    document.querySelector('#dialog-title').textContent = project ? 'Edit project' : 'New project';
    for (const field of ['id','name','description','status','progress','currentTask','nextStep','link','targetDate']) {
        const input = document.querySelector(`#project-${field.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`);
        if (input && project) input.value = project[field] ?? '';
    }
    document.querySelector('#project-id').value = project?.id || '';
    dialog.showModal();
}

async function loadProjects() { state.projects = await api('/api/admin/projects'); render(); }
async function loadNotes() {
    state.notes = await api('/api/admin/notes');
    renderNotes();
}

function showNote(note = null) {
    clearTimeout(noteSaveTimer);
    state.selectedNoteId = note?.id || null;
    document.querySelector('#editor-empty').hidden = true;
    document.querySelector('#editor-area').hidden = false;
    document.querySelector('#editor-title').value = note?.title || '';
    document.querySelector('#editor-tag').value = note?.tag || '';
    document.querySelector('#note-editor').innerHTML = note?.content || '';
    document.querySelector('#pin-note').textContent = note?.pinned ? 'Unpin' : 'Pin';
    document.querySelector('#save-status').textContent = note ? 'Saved' : 'New document';
    updateWordCount();
    renderNotes();
    document.querySelector(note ? '#note-editor' : '#editor-title').focus();
}

function hideEditor() {
    state.selectedNoteId = null;
    document.querySelector('#editor-area').hidden = true;
    document.querySelector('#editor-empty').hidden = false;
    renderNotes();
}

function updateWordCount() {
    const words = (document.querySelector('#note-editor').textContent || '').trim().match(/\S+/g)?.length || 0;
    document.querySelector('#word-count').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
}

async function saveCurrentNote() {
    const payload = {
        title: document.querySelector('#editor-title').value,
        tag: document.querySelector('#editor-tag').value,
        content: sanitiseEditorHtml(document.querySelector('#note-editor').innerHTML)
    };
    if (!payload.title.trim() && !stripHtml(payload.content).trim()) return;
    const status = document.querySelector('#save-status');
    status.textContent = 'Saving…';
    try {
        const saved = await api(state.selectedNoteId ? `/api/admin/notes/${state.selectedNoteId}` : '/api/admin/notes', { method:state.selectedNoteId ? 'PUT' : 'POST', body:JSON.stringify(payload) });
        state.selectedNoteId = saved.id;
        status.textContent = 'Saved';
        await loadNotes();
    } catch (error) {
        status.textContent = `Not saved: ${error.message}`;
    }
}

function scheduleNoteSave() {
    document.querySelector('#save-status').textContent = 'Unsaved changes';
    updateWordCount();
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(saveCurrentNote, 900);
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.querySelector('#project-id').value;
    const payload = { name:document.querySelector('#project-name').value, description:document.querySelector('#project-description').value, status:document.querySelector('#project-status').value, progress:document.querySelector('#project-progress').value, currentTask:document.querySelector('#project-current-task').value, nextStep:document.querySelector('#project-next-step').value, link:document.querySelector('#project-link').value, targetDate:document.querySelector('#project-target-date').value };
    try { await api(id ? `/api/admin/projects/${id}` : '/api/admin/projects', { method:id ? 'PUT' : 'POST', body:JSON.stringify(payload) }); dialog.close(); await loadProjects(); } catch (error) { document.querySelector('#form-error').textContent = error.message; }
});

document.querySelector('#project-list').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    const id = button.closest('.project-card').dataset.id; const project = state.projects.find((item) => item.id === id);
    if (button.dataset.action === 'edit') return openForm(project);
    if (button.dataset.action === 'archive') { await api(`/api/admin/projects/${id}/archive`, { method:'PATCH', body:JSON.stringify({ archived:!project.archived }) }); return loadProjects(); }
    const ordered = state.projects.filter((item) => !item.archived).sort((a,b) => a.order-b.order); const index = ordered.findIndex((item) => item.id === id); const target = button.dataset.action === 'up' ? index-1 : index+1;
    if (target < 0 || target >= ordered.length) return; [ordered[index],ordered[target]] = [ordered[target],ordered[index]];
    await api('/api/admin/projects/reorder', { method:'PATCH', body:JSON.stringify({ ids:ordered.map((item) => item.id) }) }); await loadProjects();
});

document.querySelector('#new-project').addEventListener('click', () => openForm());
document.querySelector('#empty-add').addEventListener('click', () => openForm());
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#cancel-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#show-archived').addEventListener('change', (event) => { state.showArchived = event.target.checked; render(); });

function formatUptime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

async function loadHealth() {
    const button = document.querySelector('#run-health-checks');
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
        const health = await api('/api/admin/health');
        const labels = { healthy:'Healthy', warning:'Needs attention', error:'Problems found' };
        const icons = { healthy:'✓', warning:'!', error:'×' };
        const orb = document.querySelector('#health-orb');
        orb.className = `health-orb ${health.overall}`;
        orb.textContent = icons[health.overall];
        document.querySelector('#health-status').textContent = labels[health.overall];
        document.querySelector('#health-checked-at').textContent = `Last checked ${new Date(health.checkedAt).toLocaleString()}`;
        document.querySelector('#health-uptime').textContent = formatUptime(health.uptimeSeconds);
        document.querySelector('#health-check-list').innerHTML = health.checks.map((check) => `
            <article class="health-check ${check.status}"><div class="check-icon">${icons[check.status]}</div><div><h3>${escapeHtml(check.label)}</h3><p>${escapeHtml(check.detail)}</p></div></article>`).join('');
    } catch (error) {
        document.querySelector('#health-status').textContent = 'Check failed';
        document.querySelector('#health-checked-at').textContent = error.message;
    } finally {
        button.disabled = false;
        button.textContent = 'Run checks';
    }
}

document.querySelectorAll('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => {
    const selectedView = button.dataset.view;
    document.querySelector('#dashboard-view').hidden = !['dashboard', 'projects'].includes(selectedView);
    document.querySelector('#notes-view').hidden = selectedView !== 'notes';
    document.querySelector('#health-view').hidden = selectedView !== 'health';
    document.querySelector('#new-project').hidden = !['dashboard', 'projects'].includes(selectedView);
    document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item === button));
    if (selectedView === 'health') loadHealth();
}));
document.querySelector('#run-health-checks').addEventListener('click', loadHealth);
document.querySelector('#new-note').addEventListener('click', () => showNote());
document.querySelector('#empty-note-add').addEventListener('click', () => showNote());
document.querySelector('#note-search').addEventListener('input', (event) => { state.noteSearch = event.target.value.trim(); renderNotes(); });
document.querySelector('#notes-list').addEventListener('click', async (event) => {
    const item = event.target.closest('[data-note-id]');
    if (!item) return;
    if (document.querySelector('#save-status').textContent === 'Unsaved changes') await saveCurrentNote();
    showNote(state.notes.find((note) => note.id === item.dataset.noteId));
});
['editor-title', 'editor-tag', 'note-editor'].forEach((id) => document.querySelector(`#${id}`).addEventListener('input', scheduleNoteSave));
document.querySelector('.format-toolbar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-command]');
    if (!button) return;
    document.execCommand(button.dataset.command, false);
    document.querySelector('#note-editor').focus();
    scheduleNoteSave();
});
document.querySelector('#block-format').addEventListener('change', (event) => { document.execCommand('formatBlock', false, event.target.value); scheduleNoteSave(); });
document.querySelector('#add-link').addEventListener('click', () => {
    const url = window.prompt('Paste an https:// link:');
    if (url && /^https?:\/\//i.test(url)) { document.execCommand('createLink', false, url); scheduleNoteSave(); }
});
document.querySelector('#pin-note').addEventListener('click', async () => {
    await saveCurrentNote();
    const note = state.notes.find((item) => item.id === state.selectedNoteId);
    if (!note) return;
    await api(`/api/admin/notes/${note.id}/pin`, { method:'PATCH', body:JSON.stringify({ pinned:!note.pinned }) });
    await loadNotes();
    showNote(state.notes.find((item) => item.id === note.id));
});
document.querySelector('#delete-note').addEventListener('click', async () => {
    const note = state.notes.find((item) => item.id === state.selectedNoteId);
    if (!note || !window.confirm(`Delete “${note.title || 'Untitled document'}”?`)) return;
    await api(`/api/admin/notes/${note.id}`, { method:'DELETE' });
    await loadNotes();
    hideEditor();
});

Promise.all([loadProjects(), loadNotes()]).catch((error) => {
    document.querySelector('#project-list').innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`;
});
