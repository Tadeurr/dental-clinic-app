// Front‑end script to integrate the dental clinic app with Firebase Firestore.
// This file largely mirrors the structure of the localStorage version but
// performs all CRUD operations against a Firestore database. Authentication
// can be implemented via Firebase Auth; for simplicity we still verify
// username/password against a "users" collection.

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';

// Access the initialized Firebase services from the global variable set in index.html
const { db, auth } = window._firebase;

// Global state
let currentUser = null;

// Entry point
render();

async function render() {
  if (!currentUser) {
    renderLoginPage();
  } else {
    renderMainPage();
  }
}

// Render login form and handle authentication
function renderLoginPage() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Sistema de Consultório Odontológico';
  wrapper.appendChild(title);
  const form = document.createElement('form');
  form.innerHTML = `
    <div>
      <label for="login-username">Usuário</label>
      <input type="text" id="login-username" required>
    </div>
    <div>
      <label for="login-password">Senha</label>
      <input type="password" id="login-password" required>
    </div>
    <button type="submit" class="primary">Entrar</button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      // Query Firestore for a user document matching username and password
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username), where('password', '==', password));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert('Usuário ou senha incorretos');
        return;
      }
      const userDoc = snapshot.docs[0];
      currentUser = { id: userDoc.id, username: userDoc.data().username, role: userDoc.data().role };
      render();
    } catch (err) {
      console.error('Erro ao autenticar', err);
      alert('Erro ao autenticar. Verifique sua conexão e tente novamente.');
    }
  });
  wrapper.appendChild(form);
  container.appendChild(wrapper);
}

// Render main page with navigation
function renderMainPage() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'Bem-vindo, ' + currentUser.username;
  const nav = document.createElement('nav');
  const ul = document.createElement('ul');
  ul.appendChild(createNavButton('Pacientes', () => renderPatientsPage()));
  ul.appendChild(createNavButton('Agendamentos', () => renderAppointmentsPage()));
  ul.appendChild(createNavButton('Procedimentos', () => renderProceduresPage()));
  if (currentUser.role === 'Admin') {
    ul.appendChild(createNavButton('Usuários', () => renderUsersPage()));
  }
  // Add clinic page for Dentistas and Admins
  if (currentUser.role === 'Dentista' || currentUser.role === 'Admin') {
    ul.appendChild(createNavButton('Consultório', () => renderClinicPage()));
    ul.appendChild(createNavButton('Faturamento', () => renderBillingPage()));
    ul.appendChild(createNavButton('Relatórios', () => renderReportsPage()));
  }
  ul.appendChild(createNavButton('Sair', () => {
    currentUser = null;
    render();
  }));
  nav.appendChild(ul);
  header.appendChild(title);
  header.appendChild(nav);
  container.appendChild(header);
  renderPatientsPage();
}

function createNavButton(text, onClick) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  li.appendChild(btn);
  return li;
}

// Helper to fetch all documents from a collection
async function fetchCollection(name) {
  const colRef = collection(db, name);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));
}

// Patients page
async function renderPatientsPage() {
  await preparePage(async () => {
    const patients = await fetchCollection('patients');
    return patients;
  }, buildPatientsSection);
}

// Generic helper to clear content and populate after async data load
async function preparePage(loadDataFn, buildFn) {
  clearContentArea();
  // Display a loading indicator
  const section = document.createElement('section');
  section.innerHTML = '<p>Carregando...</p>';
  setContentArea(section);
  try {
    const data = await loadDataFn();
    buildFn(data);
  } catch (err) {
    console.error(err);
    section.innerHTML = '<p>Erro ao carregar dados.</p>';
  }
}

// Build patients section with data
function buildPatientsSection(patients) {
  const container = document.getElementById('app');
  // Remove any existing section
  clearContentArea();
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'Pacientes';
  section.appendChild(h2);
  // Form
  const form = document.createElement('form');
  form.innerHTML = `
    <div>
      <label for="patient-name">Nome</label>
      <input type="text" id="patient-name" required>
    </div>
    <div>
      <label for="patient-age">Idade</label>
      <input type="number" id="patient-age" min="0" required>
    </div>
    <div>
      <label for="patient-phone">Telefone</label>
      <input type="text" id="patient-phone" required>
    </div>
    <div>
      <label for="patient-notes">Observações</label>
      <textarea id="patient-notes" rows="2"></textarea>
    </div>
    <button type="submit" class="primary">Salvar Paciente</button>
    <button type="button" id="patient-form-cancel" class="danger hidden">Cancelar</button>
  `;
  let editingId = null;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('patient-name').value.trim();
    const age = parseInt(document.getElementById('patient-age').value, 10);
    const phone = document.getElementById('patient-phone').value.trim();
    const notes = document.getElementById('patient-notes').value.trim();
    if (editingId) {
      const docRef = doc(db, 'patients', editingId);
      await updateDoc(docRef, { name, age, phone, notes });
      editingId = null;
    } else {
      await addDoc(collection(db, 'patients'), { name, age, phone, notes, odontogram: {} });
    }
    form.reset();
    document.getElementById('patient-form-cancel').classList.add('hidden');
    renderPatientsPage();
  });
  form.querySelector('#patient-form-cancel').addEventListener('click', () => {
    editingId = null;
    form.reset();
    form.querySelector('#patient-form-cancel').classList.add('hidden');
  });
  section.appendChild(form);
  // Table
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Nome</th><th>Idade</th><th>Telefone</th><th>Ações</th></tr></thead>';
  const tbody = document.createElement('tbody');
  patients.forEach(patient => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${patient.name}</td><td>${patient.age}</td><td>${patient.phone}</td><td></td>`;
    const actionsTd = tr.querySelector('td:last-child');
    // Edit
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.className = 'primary';
    editBtn.addEventListener('click', () => {
      editingId = patient.id;
      document.getElementById('patient-name').value = patient.name;
      document.getElementById('patient-age').value = patient.age;
      document.getElementById('patient-phone').value = patient.phone;
      document.getElementById('patient-notes').value = patient.notes || '';
      form.querySelector('#patient-form-cancel').classList.remove('hidden');
    });
    actionsTd.appendChild(editBtn);
    // Odontogram
    const odBtn = document.createElement('button');
    odBtn.textContent = 'Odontograma';
    odBtn.className = 'primary';
    odBtn.style.marginLeft = '5px';
    odBtn.addEventListener('click', () => renderOdontogramPage(patient));
    actionsTd.appendChild(odBtn);
    // Delete
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.className = 'danger';
    delBtn.style.marginLeft = '5px';
    delBtn.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja excluir este paciente?')) {
        await deleteDoc(doc(db, 'patients', patient.id));
        // Delete related appointments
        const appts = await fetchCollection('appointments');
        for (const appt of appts) {
          if (appt.patientId === patient.id) {
            await deleteDoc(doc(db, 'appointments', appt.id));
          }
        }
        renderPatientsPage();
      }
    });
    actionsTd.appendChild(delBtn);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  setContentArea(section);
}

// Odontogram page for Firestore. Accepts patient object.
function renderOdontogramPage(patient) {
  clearContentArea();
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'Odontograma de ' + patient.name;
  section.appendChild(h2);
  const desc = document.createElement('p');
  desc.textContent = 'Clique em cada dente para alternar entre saudável, cárie ou ausente.';
  section.appendChild(desc);
  const grid = document.createElement('div');
  grid.className = 'odontogram';
  // Array of tooth numbers in FDI notation (permanent teeth) displayed in two arches.
  const teethNumbers = ['18','17','16','15','14','13','12','11',
                        '21','22','23','24','25','26','27','28',
                        '48','47','46','45','44','43','42','41',
                        '31','32','33','34','35','36','37','38'];
  // Create modal for selecting status
  const statusModal = document.createElement('div');
  statusModal.className = 'status-modal hidden';
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  const modalTitle = document.createElement('h3');
  modalContent.appendChild(modalTitle);
  const selectEl = document.createElement('select');
  TOOTH_STATUS_OPTIONS.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.code;
    option.textContent = opt.label;
    selectEl.appendChild(option);
  });
  modalContent.appendChild(selectEl);
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'modal-actions';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Salvar';
  saveBtn.className = 'primary';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.className = 'danger';
  actionsDiv.appendChild(cancelBtn);
  actionsDiv.appendChild(saveBtn);
  modalContent.appendChild(actionsDiv);
  statusModal.appendChild(modalContent);
  document.body.appendChild(statusModal);

  let selectedTooth = null;
  // Function to open modal for a specific tooth
  function openModal(toothNum) {
    selectedTooth = toothNum;
    modalTitle.textContent = 'Selecionar condição para dente ' + toothNum;
    // Set select value based on existing status or empty
    const currCode = patient.odontogram && patient.odontogram[toothNum] ? patient.odontogram[toothNum] : '';
    selectEl.value = currCode;
    statusModal.classList.remove('hidden');
  }
  // Handle saving selection
  saveBtn.addEventListener('click', async () => {
    const code = selectEl.value;
    if (!patient.odontogram) patient.odontogram = {};
    patient.odontogram[selectedTooth] = code;
    // Update the button display
    const btn = grid.querySelector(`button[data-tooth="${selectedTooth}"]`);
    if (btn) {
      btn.className = '';
      // Add generic class for styling; additional CSS can be added for specific codes
      btn.classList.add('tooth');
      btn.textContent = `${selectedTooth}${code ? ' (' + code + ')' : ''}`;
    }
    await updateDoc(doc(db, 'patients', patient.id), { odontogram: patient.odontogram });
    statusModal.classList.add('hidden');
  });
  // Cancel selection
  cancelBtn.addEventListener('click', () => {
    statusModal.classList.add('hidden');
  });
  // Create tooth buttons
  teethNumbers.forEach(num => {
    const btn = document.createElement('button');
    btn.dataset.tooth = num;
    // Determine display text: show code if any
    const code = patient.odontogram && patient.odontogram[num] ? patient.odontogram[num] : '';
    btn.textContent = code ? `${num} (${code})` : num;
    btn.classList.add('tooth');
    btn.addEventListener('click', () => {
      openModal(num);
    });
    grid.appendChild(btn);
  });
  section.appendChild(grid);
  const backBtn = document.createElement('button');
  backBtn.textContent = 'Voltar';
  backBtn.className = 'primary';
  backBtn.addEventListener('click', () => {
    // Remove modal from document body when leaving page
    statusModal.remove();
    renderPatientsPage();
  });
  section.appendChild(backBtn);
  setContentArea(section);
}

// Procedures page
async function renderProceduresPage() {
  await preparePage(async () => {
    const procedures = await fetchCollection('procedures');
    return procedures;
  }, buildProceduresSection);
}

function buildProceduresSection(procedures) {
  clearContentArea();
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'Procedimentos';
  section.appendChild(h2);
  // Form
  const form = document.createElement('form');
  form.innerHTML = `
    <div>
      <label for="proc-order">Ordem</label>
      <input type="number" id="proc-order" min="0" step="1" required>
    </div>
    <div>
      <label for="proc-name">Nome</label>
      <input type="text" id="proc-name" required>
    </div>
    <div>
      <label for="proc-value">Valor (R$)</label>
      <input type="number" id="proc-value" min="0" step="0.01" required>
    </div>
    <button type="submit" class="primary">Salvar Procedimento</button>
    <button type="button" id="proc-form-cancel" class="danger hidden">Cancelar</button>
  `;
  let editingId = null;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const order = parseInt(document.getElementById('proc-order').value, 10);
    const name = document.getElementById('proc-name').value.trim();
    const value = parseFloat(document.getElementById('proc-value').value);
    if (isNaN(order) || !name || isNaN(value)) {
      alert('Preencha todos os campos');
      return;
    }
    if (editingId) {
      await updateDoc(doc(db, 'procedures', editingId), { order, name, value });
      editingId = null;
    } else {
      await addDoc(collection(db, 'procedures'), { order, name, value });
    }
    form.reset();
    form.querySelector('#proc-form-cancel').classList.add('hidden');
    renderProceduresPage();
  });
  form.querySelector('#proc-form-cancel').addEventListener('click', () => {
    editingId = null;
    form.reset();
    form.querySelector('#proc-form-cancel').classList.add('hidden');
  });
  section.appendChild(form);
  // Table
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Ordem</th><th>Nome</th><th>Valor (R$)</th><th>Ações</th></tr></thead>';
  const tbody = document.createElement('tbody');
  procedures.forEach(proc => {
    const tr = document.createElement('tr');
    const valStr = proc.value !== undefined ? Number(proc.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    tr.innerHTML = `<td>${proc.order !== undefined ? proc.order : ''}</td><td>${proc.name}</td><td>${valStr}</td><td></td>`;
    const actionsTd = tr.querySelector('td:last-child');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.className = 'primary';
    editBtn.addEventListener('click', () => {
      editingId = proc.id;
      document.getElementById('proc-order').value = proc.order !== undefined ? proc.order : '';
      document.getElementById('proc-name').value = proc.name;
      document.getElementById('proc-value').value = proc.value !== undefined ? proc.value : '';
      form.querySelector('#proc-form-cancel').classList.remove('hidden');
    });
    actionsTd.appendChild(editBtn);
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.className = 'danger';
    delBtn.style.marginLeft = '5px';
    delBtn.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja excluir este procedimento?')) {
        await deleteDoc(doc(db, 'procedures', proc.id));
        // Remove from appointments
        const appts = await fetchCollection('appointments');
        for (const appt of appts) {
          if (appt.procedureId === proc.id) {
            await deleteDoc(doc(db, 'appointments', appt.id));
          }
        }
        renderProceduresPage();
      }
    });
    actionsTd.appendChild(delBtn);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  setContentArea(section);
}

// Appointments page
async function renderAppointmentsPage() {
  await preparePage(async () => {
    const patients = await fetchCollection('patients');
    const procedures = await fetchCollection('procedures');
    const appts = await fetchCollection('appointments');
    return { patients, procedures, appts };
  }, buildAppointmentsSection);
}

function buildAppointmentsSection(data) {
  const { patients, procedures, appts } = data;
  clearContentArea();
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'Agendamentos';
  section.appendChild(h2);
  const form = document.createElement('form');
  // Build options
  const patientOptions = patients.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const procedureOptions = procedures.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  form.innerHTML = `
    <div>
      <label for="appt-patient">Paciente</label>
      <select id="appt-patient" required>
        <option value="">Selecione</option>
        ${patientOptions}
      </select>
    </div>
    <div>
      <label for="appt-procedure">Procedimento</label>
      <select id="appt-procedure" required>
        <option value="">Selecione</option>
        ${procedureOptions}
      </select>
    </div>
    <div>
      <label for="appt-date">Data e hora</label>
      <input type="datetime-local" id="appt-date" required>
    </div>
    <div>
      <label for="appt-notes">Observações</label>
      <input type="text" id="appt-notes">
    </div>
    <button type="submit" class="primary">Salvar Agendamento</button>
    <button type="button" id="appt-form-cancel" class="danger hidden">Cancelar</button>
  `;
  let editingId = null;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patientId = document.getElementById('appt-patient').value;
    const procedureId = document.getElementById('appt-procedure').value;
    const datetime = document.getElementById('appt-date').value;
    const notes = document.getElementById('appt-notes').value.trim();
    if (!patientId || !procedureId || !datetime) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    // Determine the value of the selected procedure to set totalValue
    const procObj = procedures.find(p => p.id === procedureId);
    const totalValue = procObj && procObj.value !== undefined ? procObj.value : 0;
    if (editingId) {
      await updateDoc(doc(db, 'appointments', editingId), { patientId, procedureId, datetime, notes, totalValue });
      // If procedure changed, recalc totalValue but retain existing paidAmount and paymentStatus
      editingId = null;
    } else {
      await addDoc(collection(db, 'appointments'), {
        patientId,
        procedureId,
        datetime,
        notes,
        totalValue,
        paidAmount: 0,
        paymentStatus: 'Open',
        paymentDate: ''
      });
    }
    form.reset();
    form.querySelector('#appt-form-cancel').classList.add('hidden');
    renderAppointmentsPage();
  });
  form.querySelector('#appt-form-cancel').addEventListener('click', () => {
    editingId = null;
    form.reset();
    form.querySelector('#appt-form-cancel').classList.add('hidden');
  });
  section.appendChild(form);
  // Table
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Paciente</th><th>Procedimento</th><th>Data e hora</th><th>Observações</th><th>Ações</th></tr></thead>';
  const tbody = document.createElement('tbody');
  appts.forEach(appt => {
    const patient = patients.find(p => p.id === appt.patientId);
    const proc = procedures.find(p => p.id === appt.procedureId);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${patient ? patient.name : ''}</td><td>${proc ? proc.name : ''}</td><td>${formatDateTime(appt.datetime)}</td><td>${appt.notes || ''}</td><td></td>`;
    const actionsTd = tr.querySelector('td:last-child');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.className = 'primary';
    editBtn.addEventListener('click', () => {
      editingId = appt.id;
      document.getElementById('appt-patient').value = appt.patientId;
      document.getElementById('appt-procedure').value = appt.procedureId;
      document.getElementById('appt-date').value = appt.datetime;
      document.getElementById('appt-notes').value = appt.notes || '';
      form.querySelector('#appt-form-cancel').classList.remove('hidden');
    });
    actionsTd.appendChild(editBtn);
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.className = 'danger';
    delBtn.style.marginLeft = '5px';
    delBtn.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja excluir este agendamento?')) {
        await deleteDoc(doc(db, 'appointments', appt.id));
        renderAppointmentsPage();
      }
    });
    actionsTd.appendChild(delBtn);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  setContentArea(section);
}

function formatDateTime(dt) {
  if (!dt) return '';
  const dateObj = new Date(dt);
  if (Number.isNaN(dateObj.getTime())) return dt;
  return dateObj.toLocaleString('pt-BR');
}

// Users page (admin only)
async function renderUsersPage() {
  if (currentUser.role !== 'Admin') {
    alert('Você não tem permissão para acessar esta área');
    return;
  }
  await preparePage(async () => {
    const users = await fetchCollection('users');
    return users;
  }, buildUsersSection);
}

function buildUsersSection(users) {
  clearContentArea();
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = 'Usuários';
  section.appendChild(h2);
  const form = document.createElement('form');
  form.innerHTML = `
    <div>
      <label for="user-username">Usuário</label>
      <input type="text" id="user-username" required>
    </div>
    <div>
      <label for="user-password">Senha</label>
      <input type="password" id="user-password" required>
    </div>
    <div>
      <label for="user-role">Função</label>
      <select id="user-role" required>
        <option value="">Selecione</option>
        <option value="Admin">Admin</option>
        <option value="Dentista">Dentista</option>
        <option value="Recepcionista">Recepcionista</option>
      </select>
    </div>
    <button type="submit" class="primary">Adicionar Usuário</button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    if (!username || !password || !role) {
      alert('Preencha todos os campos');
      return;
    }
    // Check duplicate
    if (users.some(u => u.username === username)) {
      alert('Nome de usuário já existe');
      return;
    }
    await addDoc(collection(db, 'users'), { username, password, role });
    form.reset();
    renderUsersPage();
  });
  section.appendChild(form);
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Usuário</th><th>Função</th><th>Ações</th></tr></thead>';
  const tbody = document.createElement('tbody');
  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${user.username}</td><td>${user.role}</td><td></td>`;
    const actionsTd = tr.querySelector('td:last-child');
    if (user.id !== currentUser.id) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Excluir';
      delBtn.className = 'danger';
      delBtn.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja excluir este usuário?')) {
          await deleteDoc(doc(db, 'users', user.id));
          renderUsersPage();
        }
      });
      actionsTd.appendChild(delBtn);
    } else {
      actionsTd.textContent = 'Logado';
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  section.appendChild(table);
  setContentArea(section);
}

// Helpers for content area
function clearContentArea() {
  const container = document.getElementById('app');
  while (container.children.length > 1) {
    container.removeChild(container.lastChild);
  }
}
function setContentArea(content) {
  const container = document.getElementById('app');
  clearContentArea();
  container.appendChild(content);
}

// List of possible tooth statuses. Each status has a code and a human‑readable label.
// These codes will be stored in the patient's odontogram map.
const TOOTH_STATUS_OPTIONS = [
  { code: '', label: 'Nenhum' },
  { code: 'PPR', label: 'Prótese parcial removível' },
  { code: 'PCU', label: 'Prótese coronária unitária' },
  { code: 'PT',  label: 'Prótese temporária' },
  { code: 'A',   label: 'Ausente' },
  { code: 'Cd',  label: 'Cálculo dental' },
  { code: 'C',   label: 'Cariado' },
  { code: 'Cr',  label: 'Coroa' },
  { code: 'Ix',  label: 'Extração indicada' },
  { code: 'F',   label: 'Fratura' },
  { code: 'H',   label: 'Higió' },
  { code: 'Hs',  label: 'Higió selado' },
  { code: 'I',   label: 'Implante' },
  { code: 'M',   label: 'Mancha branca ativa' },
  { code: 'P',   label: 'Plano' },
  { code: 'R',   label: 'Restaurado' },
  { code: 'Rc',  label: 'Restaurado com cárie' },
  { code: 'Rp',  label: 'Restaurado com placa' },
  { code: 'Rg',  label: 'Retoque gengival' },
  { code: 'S',   label: 'Selante indicado' }
];

// Clinic page: shows list of appointments (waiting list) and allows opening a consultation
async function renderClinicPage() {
  await preparePage(async () => {
    // Load all appointments, patients and procedures
    const [patients, procedures, appointments] = await Promise.all([
      fetchCollection('patients'),
      fetchCollection('procedures'),
      fetchCollection('appointments')
    ]);
    return { patients, procedures, appointments };
  }, ({ patients, procedures, appointments }) => {
    clearContentArea();
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'Consultório – Lista de Atendimentos';
    section.appendChild(h2);
    if (appointments.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'Não há agendamentos cadastrados.';
      section.appendChild(p);
    } else {
      // Sort appointments by datetime ascending
      appointments.sort((a, b) => {
        const da = new Date(a.datetime);
        const db = new Date(b.datetime);
        return da - db;
      });
      const ul = document.createElement('ul');
      ul.style.listStyle = 'none';
      ul.style.padding = '0';
      appointments.forEach(appt => {
        const li = document.createElement('li');
        li.style.marginBottom = '10px';
        const patient = patients.find(p => p.id === appt.patientId);
        const procedure = procedures.find(p => p.id === appt.procedureId);
        const info = document.createElement('span');
        info.textContent = `${formatDateTime(appt.datetime)} – ${patient ? patient.name : ''} – ${procedure ? procedure.name : ''}`;
        const openBtn = document.createElement('button');
        openBtn.textContent = 'Atender';
        openBtn.className = 'primary';
        openBtn.style.marginLeft = '10px';
        openBtn.addEventListener('click', () => {
          renderConsultationPage(appt, patient);
        });
        li.appendChild(info);
        li.appendChild(openBtn);
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }
    setContentArea(section);
  });
}

// Consultation page: display anamnesis and odontogram for a specific appointment
function renderConsultationPage(appointment, patient) {
  clearContentArea();
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  const procDatetime = formatDateTime(appointment.datetime);
  h2.textContent = `Consulta – ${patient.name} (${procDatetime})`;
  section.appendChild(h2);
  // Anamnesis
  const anamDiv = document.createElement('div');
  const anamLabel = document.createElement('label');
  anamLabel.textContent = 'Anamnese';
  anamLabel.htmlFor = 'anamnesis';
  const anamTextarea = document.createElement('textarea');
  anamTextarea.id = 'anamnesis';
  anamTextarea.rows = 4;
  anamTextarea.style.width = '100%';
  anamTextarea.value = appointment.anamnesis || '';
  anamDiv.appendChild(anamLabel);
  anamDiv.appendChild(anamTextarea);
  section.appendChild(anamDiv);
  // Save anamnesis button
  const saveAnamBtn = document.createElement('button');
  saveAnamBtn.textContent = 'Salvar Anamnese';
  saveAnamBtn.className = 'primary';
  saveAnamBtn.style.marginBottom = '20px';
  saveAnamBtn.addEventListener('click', async () => {
    const text = anamTextarea.value.trim();
    await updateDoc(doc(db, 'appointments', appointment.id), { anamnesis: text });
    alert('Anamnese salva');
  });
  section.appendChild(saveAnamBtn);
  // Odontogram embedded for this patient
  const odontoHeader = document.createElement('h3');
  odontoHeader.textContent = 'Odontograma';
  section.appendChild(odontoHeader);
  // We will embed a simplified version of renderOdontogramPage here to allow editing without leaving the consultation
  const grid = document.createElement('div');
  grid.className = 'odontogram';
  const teethNumbers = ['18','17','16','15','14','13','12','11',
                        '21','22','23','24','25','26','27','28',
                        '48','47','46','45','44','43','42','41',
                        '31','32','33','34','35','36','37','38'];
  // Create modal for selecting status
  const statusModal = document.createElement('div');
  statusModal.className = 'status-modal hidden';
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  const modalTitle = document.createElement('h3');
  modalContent.appendChild(modalTitle);
  const selectEl = document.createElement('select');
  TOOTH_STATUS_OPTIONS.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.code;
    option.textContent = opt.label;
    selectEl.appendChild(option);
  });
  modalContent.appendChild(selectEl);
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'modal-actions';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Salvar';
  saveBtn.className = 'primary';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.className = 'danger';
  actionsDiv.appendChild(cancelBtn);
  actionsDiv.appendChild(saveBtn);
  modalContent.appendChild(actionsDiv);
  statusModal.appendChild(modalContent);
  document.body.appendChild(statusModal);
  let selectedTooth = null;
  function openModal(toothNum) {
    selectedTooth = toothNum;
    modalTitle.textContent = 'Selecionar condição para dente ' + toothNum;
    const currCode = patient.odontogram && patient.odontogram[toothNum] ? patient.odontogram[toothNum] : '';
    selectEl.value = currCode;
    statusModal.classList.remove('hidden');
  }
  saveBtn.addEventListener('click', async () => {
    const code = selectEl.value;
    if (!patient.odontogram) patient.odontogram = {};
    patient.odontogram[selectedTooth] = code;
    const btn = grid.querySelector(`button[data-tooth="${selectedTooth}"]`);
    if (btn) {
      btn.className = '';
      btn.classList.add('tooth');
      btn.textContent = `${selectedTooth}${code ? ' (' + code + ')' : ''}`;
    }
    await updateDoc(doc(db, 'patients', patient.id), { odontogram: patient.odontogram });
    statusModal.classList.add('hidden');
  });
  cancelBtn.addEventListener('click', () => {
    statusModal.classList.add('hidden');
  });
  teethNumbers.forEach(num => {
    const btn = document.createElement('button');
    btn.dataset.tooth = num;
    const code = patient.odontogram && patient.odontogram[num] ? patient.odontogram[num] : '';
    btn.textContent = code ? `${num} (${code})` : num;
    btn.classList.add('tooth');
    btn.addEventListener('click', () => {
      openModal(num);
    });
    grid.appendChild(btn);
  });
  section.appendChild(grid);
  // Back button
  const backBtn = document.createElement('button');
  backBtn.textContent = 'Voltar';
  backBtn.className = 'primary';
  backBtn.style.marginTop = '20px';
  backBtn.addEventListener('click', () => {
    statusModal.remove();
    renderClinicPage();
  });
  section.appendChild(backBtn);
  setContentArea(section);
}

// Billing page: allows registering payments for appointments
async function renderBillingPage() {
  await preparePage(async () => {
    const [patients, procedures, appointments] = await Promise.all([
      fetchCollection('patients'),
      fetchCollection('procedures'),
      fetchCollection('appointments')
    ]);
    return { patients, procedures, appointments };
  }, ({ patients, procedures, appointments }) => {
    clearContentArea();
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'Faturamento';
    section.appendChild(h2);
    if (appointments.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'Não há agendamentos cadastrados.';
      section.appendChild(p);
    } else {
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Paciente</th><th>Procedimento</th><th>Data/Hora</th><th>Valor Total (R$)</th><th>Valor Pago (R$)</th><th>Status</th><th>Data de Pagamento</th><th>Ações</th></tr></thead>';
      const tbody = document.createElement('tbody');
      appointments.forEach(appt => {
        const patient = patients.find(p => p.id === appt.patientId);
        const proc = procedures.find(p => p.id === appt.procedureId);
        const tr = document.createElement('tr');
        const totalVal = appt.totalValue !== undefined ? Number(appt.totalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
        const paidVal = appt.paidAmount !== undefined ? Number(appt.paidAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
        tr.innerHTML = `<td>${patient ? patient.name : ''}</td><td>${proc ? proc.name : ''}</td><td>${formatDateTime(appt.datetime)}</td><td>${totalVal}</td><td>${paidVal}</td><td>${appt.paymentStatus || ''}</td><td>${appt.paymentDate || ''}</td><td></td>`;
        const actionsTd = tr.querySelector('td:last-child');
        if (appt.paymentStatus !== 'Paid') {
          const payBtn = document.createElement('button');
          payBtn.textContent = 'Registrar Pagamento';
          payBtn.className = 'primary';
          payBtn.addEventListener('click', () => {
            openPaymentModal(appt);
          });
          actionsTd.appendChild(payBtn);
        } else {
          actionsTd.textContent = '';
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      section.appendChild(table);
    }
    setContentArea(section);
  });

  // Payment modal
  function openPaymentModal(appt) {
    const overlay = document.createElement('div');
    overlay.className = 'status-modal';
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    const title = document.createElement('h3');
    title.textContent = 'Registrar pagamento';
    modal.appendChild(title);
    const formDiv1 = document.createElement('div');
    const labelVal = document.createElement('label');
    labelVal.textContent = 'Valor pago (R$)';
    const inputVal = document.createElement('input');
    inputVal.type = 'number';
    inputVal.min = '0';
    inputVal.step = '0.01';
    // Sugestão de valor: restante a pagar
    const remaining = (appt.totalValue || 0) - (appt.paidAmount || 0);
    inputVal.value = remaining.toFixed(2);
    formDiv1.appendChild(labelVal);
    formDiv1.appendChild(inputVal);
    modal.appendChild(formDiv1);
    const formDiv2 = document.createElement('div');
    const labelDate = document.createElement('label');
    labelDate.textContent = 'Data de pagamento';
    const inputDate = document.createElement('input');
    inputDate.type = 'date';
    // Default to today
    inputDate.value = new Date().toISOString().substring(0, 10);
    formDiv2.appendChild(labelDate);
    formDiv2.appendChild(inputDate);
    modal.appendChild(formDiv2);
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.className = 'danger';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Salvar';
    saveBtn.className = 'primary';
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    // Cancel
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
    });
    // Save payment
    saveBtn.addEventListener('click', async () => {
      const payVal = parseFloat(inputVal.value);
      const payDate = inputDate.value;
      if (isNaN(payVal) || payVal <= 0) {
        alert('Informe um valor válido');
        return;
      }
      const newPaid = (appt.paidAmount || 0) + payVal;
      let status = 'Partial';
      if (newPaid >= (appt.totalValue || 0)) {
        status = 'Paid';
      } else if (newPaid <= 0) {
        status = 'Open';
      }
      await updateDoc(doc(db, 'appointments', appt.id), {
        paidAmount: newPaid,
        paymentStatus: status,
        paymentDate: payDate
      });
      overlay.remove();
      // Refresh billing page
      renderBillingPage();
    });
  }
}

// Reports dashboard page
async function renderReportsPage() {
  await preparePage(async () => {
    const [procedures, appointments] = await Promise.all([
      fetchCollection('procedures'),
      fetchCollection('appointments')
    ]);
    return { procedures, appointments };
  }, ({ procedures, appointments }) => {
    clearContentArea();
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = 'Relatórios';
    section.appendChild(h2);
    // Compute metrics
    const totalAppointments = appointments.length;
    const now = new Date();
    const totalConsultations = appointments.filter(a => new Date(a.datetime) <= now).length;
    let totalBilled = 0;
    let totalPaid = 0;
    const patientDebts = new Set();
    const procedureCounts = {};
    appointments.forEach(appt => {
      const tv = appt.totalValue || 0;
      const paid = appt.paidAmount || 0;
      totalBilled += tv;
      totalPaid += paid;
      if ((appt.paymentStatus || 'Open') !== 'Paid') {
        patientDebts.add(appt.patientId);
      }
      // Count procedure occurrences
      if (appt.procedureId) {
        procedureCounts[appt.procedureId] = (procedureCounts[appt.procedureId] || 0) + 1;
      }
    });
    const totalPending = totalBilled - totalPaid;
    // Create cards for summary numbers
    const summaries = [
      { label: 'Total de agendamentos', value: totalAppointments },
      { label: 'Consultas realizadas', value: totalConsultations },
      { label: 'Valor faturado', value: totalBilled.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
      { label: 'Valor pago', value: totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
      { label: 'Valor pendente', value: totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
      { label: 'Pacientes com débito', value: patientDebts.size }
    ];
    const summaryDiv = document.createElement('div');
    summaryDiv.style.display = 'grid';
    summaryDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
    summaryDiv.style.gap = '10px';
    summaries.forEach(item => {
      const card = document.createElement('div');
      card.style.background = '#f8f9fa';
      card.style.padding = '10px';
      card.style.border = '1px solid #ddd';
      card.style.borderRadius = '6px';
      const lbl = document.createElement('h4');
      lbl.textContent = item.label;
      const val = document.createElement('p');
      val.style.fontSize = '18px';
      val.style.margin = '5px 0 0 0';
      val.textContent = item.value;
      card.appendChild(lbl);
      card.appendChild(val);
      summaryDiv.appendChild(card);
    });
    section.appendChild(summaryDiv);
    // Top procedures table
    const topTable = document.createElement('table');
    topTable.style.marginTop = '20px';
    topTable.innerHTML = '<thead><tr><th>Procedimento</th><th>Quantidade</th></tr></thead>';
    const topTbody = document.createElement('tbody');
    // Compute top 5
    const sorted = Object.entries(procedureCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sorted.forEach(([procId, count]) => {
      const proc = procedures.find(p => p.id === procId);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${proc ? proc.name : procId}</td><td>${count}</td>`;
      topTbody.appendChild(tr);
    });
    topTable.appendChild(topTbody);
    const topCaption = document.createElement('h3');
    topCaption.textContent = 'Procedimentos mais realizados';
    section.appendChild(document.createElement('hr'));
    section.appendChild(topCaption);
    section.appendChild(topTable);
    setContentArea(section);
  });
}