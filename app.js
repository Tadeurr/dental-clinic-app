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
  const teethNumbers = ['18','17','16','15','14','13','12','11',
                        '21','22','23','24','25','26','27','28',
                        '48','47','46','45','44','43','42','41',
                        '31','32','33','34','35','36','37','38'];
  teethNumbers.forEach(num => {
    const btn = document.createElement('button');
    btn.dataset.tooth = num;
    const status = patient.odontogram && patient.odontogram[num] ? patient.odontogram[num] : 'healthy';
    btn.classList.add(status);
    btn.textContent = num;
    btn.addEventListener('click', async () => {
      let curr = patient.odontogram ? patient.odontogram[num] : 'healthy';
      if (!curr) curr = 'healthy';
      if (curr === 'healthy') curr = 'caries';
      else if (curr === 'caries') curr = 'missing';
      else curr = 'healthy';
      if (!patient.odontogram) patient.odontogram = {};
      patient.odontogram[num] = curr;
      btn.className = '';
      btn.classList.add(curr);
      btn.textContent = num;
      // Persist update
      await updateDoc(doc(db, 'patients', patient.id), { odontogram: patient.odontogram });
    });
    grid.appendChild(btn);
  });
  section.appendChild(grid);
  const backBtn = document.createElement('button');
  backBtn.textContent = 'Voltar';
  backBtn.className = 'primary';
  backBtn.addEventListener('click', () => {
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
      <label for="proc-name">Nome</label>
      <input type="text" id="proc-name" required>
    </div>
    <div>
      <label for="proc-desc">Descrição</label>
      <input type="text" id="proc-desc">
    </div>
    <button type="submit" class="primary">Salvar Procedimento</button>
    <button type="button" id="proc-form-cancel" class="danger hidden">Cancelar</button>
  `;
  let editingId = null;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('proc-name').value.trim();
    const desc = document.getElementById('proc-desc').value.trim();
    if (editingId) {
      await updateDoc(doc(db, 'procedures', editingId), { name, description: desc });
      editingId = null;
    } else {
      await addDoc(collection(db, 'procedures'), { name, description: desc });
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
  table.innerHTML = '<thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead>';
  const tbody = document.createElement('tbody');
  procedures.forEach(proc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${proc.name}</td><td>${proc.description || ''}</td><td></td>`;
    const actionsTd = tr.querySelector('td:last-child');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.className = 'primary';
    editBtn.addEventListener('click', () => {
      editingId = proc.id;
      document.getElementById('proc-name').value = proc.name;
      document.getElementById('proc-desc').value = proc.description || '';
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
    if (editingId) {
      await updateDoc(doc(db, 'appointments', editingId), { patientId, procedureId, datetime, notes });
      editingId = null;
    } else {
      await addDoc(collection(db, 'appointments'), { patientId, procedureId, datetime, notes });
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