const state = { projects: [], showArchived: false };
const dialog = document.querySelector('#project-dialog');
const form = document.querySelector('#project-form');

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
loadProjects().catch((error) => { document.querySelector('#project-list').innerHTML = `<p class="form-error">${escapeHtml(error.message)}</p>`; });
