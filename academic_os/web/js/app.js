const API = '';
let currentView = 'dashboard';
let cursosCache = [];
let deferredInstall = null;

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || r.statusText);
  }
  return r.json();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function nav(view) {
  currentView = view;
  $$('nav.bottom button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  render();
}

function setHeader(title, sub = '') {
  $('#hdr-title').textContent = title;
  $('#hdr-sub').textContent = sub;
}

async function render() {
  const main = $('#main');
  main.innerHTML = '<div class="loading">Cargando…</div>';
  try {
    if (currentView === 'dashboard') await renderDashboard(main);
    else if (currentView === 'tareas') await renderTareas(main);
    else if (currentView === 'cursos') await renderCursos(main);
    else if (currentView === 'tb') await renderTB(main);
    else if (currentView === 'riesgo') await renderRiesgo(main);
    else if (currentView === 'config') await renderConfig(main);
  } catch (e) {
    main.innerHTML = `<div class="card danger"><p>Error: ${e.message}</p><p class="meta">¿Está el servidor encendido?</p></div>`;
  }
}

async function renderDashboard(el) {
  const d = await api('/api/dashboard');
  setHeader(`Hola, ${d.saludo}`, d.fecha);
  const dom = d.dominio;
  const pct = dom.porcentaje || 0;
  el.innerHTML = `
    <div class="install-banner" id="install-hint">📲 Toca <b>Instalar app</b> abajo para añadir Academic OS a tu pantalla de inicio</div>
    <div class="card">
      <h3>Preparación académica</h3>
      <div class="stat-big">${pct}%</div>
      <p style="font-size:0.85rem;margin:4px 0">${dom.dominados} de ${dom.total} temas dominados</p>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="stat-row">
        <span class="chip">💀 ${dom.cero_pista} sin pista</span>
        <span class="chip">🔥 ${dom.lo_tengo} dominados</span>
      </div>
    </div>
    <div class="card">
      <h3>Hoy</h3>
      <p>⚡ ${d.progreso_dia.done}/${d.progreso_dia.total} bloques · 🔥 ${d.racha} días racha</p>
      <p style="margin-top:6px">📋 ${d.tareas_pendientes} tareas pendientes</p>
    </div>
    ${d.examenes.length ? `<div class="card"><h3>Próximos exámenes</h3><div class="scroll-x">${d.examenes.map((e) => `
      <div class="exam-card" style="border-color:${e.semaforo === 'ROJO' || e.semaforo === 'ROJO_CRITICO' ? 'var(--red)' : 'var(--yellow)'}">
        <div style="font-size:0.75rem;color:var(--text-sec)">${e.curso_nombre}</div>
        <div style="font-weight:600;font-size:0.8rem">${e.nombre}</div>
        <div class="days">${e.dias_restantes ?? '—'}</div>
        <div style="font-size:0.7rem">días</div>
      </div>`).join('')}</div></div>` : ''}
    ${d.misiones.length ? `<div class="card"><h3>Misiones de hoy</h3>${d.misiones.map((t) => taskHtml(t)).join('')}</div>` : ''}
  `;
  bindTasks(el);
}

async function renderTareas(el) {
  setHeader('Gestor de Tareas', 'Pendientes y urgentes');
  const tareas = (await api('/api/tareas')).filter((t) => t.estado !== 'completada');
  el.innerHTML = `
    <button class="btn btn-accent" style="width:100%;margin-bottom:12px" onclick="openNewTask()">+ Nueva tarea</button>
    <div class="card">${tareas.length ? tareas.map((t) => taskHtml(t)).join('') : '<p style="color:var(--text-sec)">Sin tareas pendientes 🎉</p>'}</div>
  `;
  bindTasks(el);
}

function taskHtml(t) {
  const pr = { urgente: '🔴', importante: '🟡', normal: '🟢' }[t.prioridad] || '🟢';
  return `<div class="task" data-id="${t.id}">
    <div class="info">
      <div class="title">${esc(t.titulo)}</div>
      <div class="meta">${pr} ${t.fecha_limite || 'Sin fecha'} · ${t.duracion_min || 30}m</div>
    </div>
    <button class="btn btn-sm btn-green" data-done="${t.id}">✓</button>
  </div>`;
}

function bindTasks(el) {
  el.querySelectorAll('[data-done]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/tareas/${btn.dataset.done}/completar`, { method: 'POST' });
      toast('Tarea completada');
      render();
    };
  });
}

async function renderCursos(el) {
  if (el.dataset.cursoId) {
    await renderCursoDetalle(el, +el.dataset.cursoId);
    return;
  }
  setHeader('Mis Cursos', 'Temas y unidades');
  cursosCache = await api('/api/cursos');
  el.innerHTML = cursosCache.map((c) => `
    <div class="card" style="border-left:4px solid ${c.color}" data-curso="${c.id}">
      <div style="font-weight:700;font-size:1rem">${esc(c.nombre)}</div>
      <div class="bar"><div style="width:${Math.round(c.avance * 100)}%;background:${c.color}"></div></div>
      <p style="font-size:0.8rem;color:var(--text-sec)">${c.dominados}/${c.total_temas} temas dominados</p>
    </div>`).join('');
  el.querySelectorAll('[data-curso]').forEach((card) => {
    card.onclick = () => { el.dataset.cursoId = card.dataset.curso; render(); };
  });
}

async function renderCursoDetalle(el, id) {
  const c = await api(`/api/cursos/${id}`);
  setHeader(c.nombre, `${Math.round(c.avance * 100)}% dominado`);
  el.innerHTML = `
    <button class="back-btn" id="back-cursos">← Volver a cursos</button>
    ${c.unidades.map((u) => `
      <div class="card">
        <div style="font-weight:600">${esc(u.nombre)}</div>
        <p style="font-size:0.78rem;color:var(--text-sec)">Examen: ${u.fecha_examen || '—'} (${u.dias_examen ?? '?'}d)</p>
        <div class="bar"><div style="width:${Math.round(u.avance * 100)}%"></div></div>
        ${u.temas.map((t) => `
          <div class="task" style="padding:6px 0">
            <div class="info">
              <div class="title" style="font-size:0.82rem">${esc(t.nombre)}</div>
              <div class="meta">${t.dominio.replace(/_/g, ' ')}</div>
            </div>
            <select data-tema="${t.id}" style="width:auto;margin:0;font-size:0.75rem;padding:4px">
              <option value="cero_pista" ${t.dominio==='cero_pista'?'selected':''}>💀</option>
              <option value="entendiendo" ${t.dominio==='entendiendo'?'selected':''}>🌱</option>
              <option value="casi_listo" ${t.dominio==='casi_listo'?'selected':''}>⚡</option>
              <option value="lo_tengo" ${t.dominio==='lo_tengo'?'selected':''}>🔥</option>
            </select>
          </div>`).join('')}
      </div>`).join('')}
  `;
  $('#back-cursos').onclick = () => { delete el.dataset.cursoId; render(); };
  el.querySelectorAll('[data-tema]').forEach((sel) => {
    sel.onchange = async () => {
      await api(`/api/temas/${sel.dataset.tema}`, { method: 'PATCH', body: JSON.stringify({ dominio: sel.value }) });
      toast('Dominio actualizado');
    };
  });
}

async function renderTB(el) {
  setHeader('TimeBlocking', 'Bloques de hoy');
  const data = await api('/api/bloques');
  const nowId = data.bloque_actual?.id;
  el.innerHTML = `
    <div class="card">
      <p>⚡ ${data.progreso.done}/${data.progreso.total} bloques · ${Math.round(data.progreso.pct)}%</p>
      <div class="bar"><div style="width:${data.progreso.pct}%"></div></div>
    </div>
    <div class="card">
      ${data.bloques.length ? data.bloques.map((b) => `
        <div class="block-row ${b.id === nowId ? 'now' : ''} ${b.estado === 'completado' ? 'done' : ''}">
          <div class="time">${(b.hora_inicio || '').slice(0, 5)}</div>
          <div class="block-body">${b.estado === 'completado' ? '✓ ' : ''}${esc(b.titulo || 'Bloque')}</div>
          ${b.estado !== 'completado' ? `<button class="btn btn-sm btn-green" data-bloque="${b.id}">✓</button>` : ''}
        </div>`).join('') : '<p style="color:var(--text-sec)">Sin bloques hoy</p>'}
    </div>
    <button class="btn btn-purple" style="width:100%" onclick="openNewBlock()">+ Crear bloque rápido</button>
  `;
  el.querySelectorAll('[data-bloque]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/bloques/${btn.dataset.bloque}/completar`, { method: 'POST' });
      toast('Bloque completado');
      render();
    };
  });
}

async function renderRiesgo(el) {
  setHeader('Centro de Riesgo', 'Alertas y peligros');
  const r = await api('/api/riesgo');
  const lvl = r.nivel;
  let color = 'var(--green)', lbl = '🟢 SEGURO';
  if (lvl > 75) { color = 'var(--red)'; lbl = '🔴 EMERGENCIA'; }
  else if (lvl > 50) { color = 'var(--orange,#e17055)'; lbl = '🟠 PELIGRO'; }
  else if (lvl > 25) { color = 'var(--yellow)'; lbl = '🟡 ALERTA'; }

  el.innerHTML = `
    <div class="level-banner card" style="border:2px solid ${color}">
      <div class="lbl">${lbl}</div>
      <div class="lvl" style="color:${color}">${lvl}</div>
      <div style="font-size:0.8rem;color:var(--text-sec)">Nivel de riesgo / 100</div>
    </div>
    <div class="metric-grid">
      <div class="metric-box" style="border-color:var(--red)"><div class="num" style="color:var(--red)">${r.tareas_vencidas.length}</div><div style="font-size:0.72rem">Vencidas</div></div>
      <div class="metric-box" style="border-color:var(--orange,#e17055)"><div class="num" style="color:var(--yellow)">${r.tareas_urgentes.length}</div><div style="font-size:0.72rem">Urgentes</div></div>
      <div class="metric-box" style="border-color:var(--yellow)"><div class="num" style="color:var(--yellow)">${r.examenes_criticos.length}</div><div style="font-size:0.72rem">Exámenes &lt;7d</div></div>
      <div class="metric-box" style="border-color:var(--accent2)"><div class="num" style="color:var(--accent2)">${r.temas_sin_dominar}</div><div style="font-size:0.72rem">Sin dominar</div></div>
    </div>
    ${r.tareas_vencidas.length ? `<div class="card danger" style="margin-top:12px"><h3>⚠️ Tareas vencidas</h3>${r.tareas_vencidas.map((t) => `<p style="font-size:0.85rem;padding:4px 0">• ${esc(t.titulo)}</p>`).join('')}</div>` : ''}
    ${r.examenes_criticos.length ? `<div class="card" style="margin-top:10px;border-color:var(--red)"><h3>Exámenes críticos</h3>${r.examenes_criticos.map((e) => `<p style="font-size:0.85rem;padding:4px 0">• ${esc(e.curso_nombre)} — ${e.dias_restantes}d (${Math.round(e.avance*100)}%)</p>`).join('')}</div>` : ''}
  `;
}

async function renderConfig(el) {
  setHeader('Configuración', 'Perfil y conexión');
  const c = await api('/api/config');
  el.innerHTML = `
    <div class="card">
      <label>Tu nombre</label>
      <input id="cfg-nombre" value="${esc(c.nombre_usuario)}">
      <label>Meta horas semanal</label>
      <input id="cfg-meta" value="${esc(c.meta_horas_semanal)}">
      <label>DeepSeek API Key ${c.ia_configurada ? '✅' : '❌'}</label>
      <input id="cfg-key" type="password" placeholder="sk-...">
      <button class="btn btn-accent" style="width:100%;margin-top:8px" id="save-cfg">Guardar</button>
    </div>
    <div class="card">
      <h3>Instalar en Android</h3>
      <p style="font-size:0.82rem;color:var(--text-sec);line-height:1.5">
        1. Conecta el teléfono a la misma WiFi que la PC<br>
        2. Abre Chrome → <b id="mobile-url">esta URL</b><br>
        3. Menú ⋮ → <b>Añadir a pantalla de inicio</b><br>
        4. ¡Listo! Funciona como app nativa
      </p>
      <button class="btn btn-purple" style="width:100%;margin-top:8px" id="btn-install" hidden>📲 Instalar app</button>
    </div>
    <button class="btn btn-blue" style="width:100%" id="btn-ai">🤖 Sugerencia IA (tareas)</button>
    <pre id="ai-out" style="margin-top:10px;font-size:0.75rem;color:var(--text-sec);white-space:pre-wrap;display:none"></pre>
  `;
  $('#mobile-url').textContent = location.origin;
  $('#save-cfg').onclick = async () => {
    const body = { nombre_usuario: $('#cfg-nombre').value, meta_horas_semanal: $('#cfg-meta').value };
    const key = $('#cfg-key').value.trim();
    if (key) body.deepseek_api_key = key;
    await api('/api/config', { method: 'POST', body: JSON.stringify(body) });
    toast('Configuración guardada');
  };
  $('#btn-ai').onclick = async () => {
    $('#ai-out').style.display = 'block';
    $('#ai-out').textContent = 'Pensando…';
    try {
      const r = await api('/api/ai/priorizar', { method: 'POST' });
      $('#ai-out').textContent = r.mensaje;
    } catch (e) {
      $('#ai-out').textContent = e.message;
    }
  };
  const bi = $('#btn-install');
  if (deferredInstall) { bi.hidden = false; bi.onclick = () => deferredInstall.prompt(); }
}

function openNewTask() {
  const m = $('#modal');
  m.classList.add('open');
  $('#modal-body').innerHTML = `
    <h2>Nueva tarea</h2>
    <label>Título</label><input id="nt-titulo">
    <label>Fecha límite</label><input id="nt-fecha" type="date">
    <label>Prioridad</label>
    <select id="nt-prior"><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select>
    <button class="btn btn-accent" style="width:100%" id="nt-save">Crear</button>
  `;
  $('#nt-save').onclick = async () => {
    await api('/api/tareas', {
      method: 'POST',
      body: JSON.stringify({
        titulo: $('#nt-titulo').value,
        fecha_limite: $('#nt-fecha').value || null,
        prioridad: $('#nt-prior').value,
        duracion_min: 30,
      }),
    });
    m.classList.remove('open');
    toast('Tarea creada');
    render();
  };
}

function openNewBlock() {
  const m = $('#modal');
  m.classList.add('open');
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m2 = String(Math.ceil(now.getMinutes() / 30) * 30 % 60).padStart(2, '0');
  $('#modal-body').innerHTML = `
    <h2>Nuevo bloque</h2>
    <label>Título</label><input id="nb-titulo" value="Estudio">
    <label>Hora inicio (HH:MM)</label><input id="nb-hi" value="${h}:${m2}">
    <button class="btn btn-accent" style="width:100%" id="nb-save">Crear</button>
  `;
  $('#nb-save').onclick = async () => {
    const hi = $('#nb-hi').value;
    const [hh, mm] = hi.split(':').map(Number);
    const fin = new Date(); fin.setHours(hh, mm + 30, 0);
    const hf = `${String(fin.getHours()).padStart(2,'0')}:${String(fin.getMinutes()).padStart(2,'0')}:00`;
    await api('/api/bloques', {
      method: 'POST',
      body: JSON.stringify({
        titulo: $('#nb-titulo').value,
        hora_inicio: hi + ':00',
        hora_fin: hf,
        tipo: 'estudio',
      }),
    });
    m.classList.remove('open');
    toast('Bloque creado');
    nav('tb');
  };
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function init() {
  $$('nav.bottom button').forEach((b) => b.addEventListener('click', () => nav(b.dataset.view)));
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') e.target.classList.remove('open'); });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    const hint = $('#install-hint');
    if (hint) hint.classList.add('show');
    const bi = $('#btn-install');
    if (bi) { bi.hidden = false; bi.onclick = () => e.prompt(); }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  render();
}

document.addEventListener('DOMContentLoaded', init);
