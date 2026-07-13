// ===== CONFIGURACIÓN FIREBASE =====
const firebaseConfig = {
    apiKey: "AIzaSyDEFAULT_KEY_REPLACE_ME",
    authDomain: "departamentoasuntoscomunitario.firebaseapp.com",
    databaseURL: "https://departamentoasuntoscomunitario-default-rtdb.firebaseio.com",
    projectId: "departamentoasuntoscomunitario",
    storageBucket: "departamentoasuntoscomunitario.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== VARIABLES GLOBALES =====
let currentUser = null;
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
let bloquesCache = {};
let callesCache = {};
let encuestadoresCache = {};
let presidentesCache = {};
let censoCache = {};
let listenersActivos = false;
let selectoresInicializados = false;

// ===== REFERENCIAS EN TIEMPO REAL =====
let bloquesListener = null;
let callesListener = null;
let encuestadoresListener = null;
let presidentesListener = null;
let censoListener = null;

// ============================================
// ===== FORMATOS AUTOMÁTICOS =====
// ============================================

function formatearCedula(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor.length > 11) valor = valor.substring(0, 11);
    
    let resultado = '';
    if (valor.length > 0) {
        resultado = valor.substring(0, 3);
        if (valor.length > 3) {
            resultado += '-' + valor.substring(3, 10);
            if (valor.length > 10) {
                resultado += '-' + valor.substring(10, 11);
            }
        }
    }
    input.value = resultado;
    return resultado;
}

function formatearTelefono(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor.length > 10) valor = valor.substring(0, 10);
    
    let resultado = '';
    if (valor.length > 0) {
        resultado = '(' + valor.substring(0, 3);
        if (valor.length > 3) {
            resultado += ') ' + valor.substring(3, 6);
            if (valor.length > 6) {
                resultado += '-' + valor.substring(6, 10);
            }
        }
    }
    input.value = resultado;
    return resultado;
}

function convertirMayusculas(texto) {
    if (!texto) return '';
    return texto.toString().toUpperCase();
}

// ============================================
// ===== SISTEMA DE NOTIFICACIONES =====
// ============================================

function showNotification(mensaje, tipo = 'success', duracion = 3000) {
    const notificacionAnterior = document.querySelector('.custom-notification');
    if (notificacionAnterior) {
        notificacionAnterior.remove();
    }
    
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };
    
    const iconos = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        border-left: 5px solid ${colors[tipo] || colors.success};
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 280px;
        max-width: 450px;
        animation: slideInRight 0.4s ease;
        font-family: 'Poppins', sans-serif;
        font-size: 0.95rem;
    `;
    
    notification.innerHTML = `
        <i class="fas ${iconos[tipo] || iconos.success}" style="color: ${colors[tipo] || colors.success}; font-size: 1.5rem;"></i>
        <div style="flex:1;">
            <span style="color: #2c3e50;">${mensaje}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; color: #999; font-size: 1.2rem;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, duracion);
}

const styleNotificaciones = document.createElement('style');
styleNotificaciones.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(styleNotificaciones);

// ============================================
// ===== LOADING OVERLAY =====
// ============================================

function showLoading(mensaje = 'Guardando datos...') {
    const overlayAnterior = document.getElementById('loadingOverlay');
    if (overlayAnterior) {
        overlayAnterior.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay active';
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        backdrop-filter: blur(4px);
        animation: fadeIn 0.3s ease;
    `;
    overlay.innerHTML = `
        <div style="
            background: white;
            padding: 40px 50px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
            <div style="
                width: 60px;
                height: 60px;
                margin: 0 auto 20px;
                border: 5px solid #f5f7fa;
                border-top: 5px solid #B8860B;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            "></div>
            <h3 style="color: #1a3c5e; margin-bottom: 8px;">${mensaje}</h3>
            <p style="color: #6b7a8f; font-size: 0.9rem;">Por favor espere...</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.remove();
            }
        }, 300);
    }
}

function ejecutarConLoading(callback, mensaje = 'Guardando datos...') {
    showLoading(mensaje);
    setTimeout(() => {
        callback();
        setTimeout(hideLoading, 600);
    }, 400);
}

// ============================================
// ===== LOGIN =====
// ============================================

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        currentUser = { username: user, name: 'Administrador', role: 'admin' };
        document.getElementById('userNameDisplay').textContent = 'Administrador';
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('loginError').textContent = '';
        mostrarMenuAdmin(true);
        iniciarEscuchaTiempoReal();
        cargarDatosIniciales();
        showNotification('✅ Bienvenido Administrador', 'success');
    } else {
        verificarEncuestador(user, pass);
    }
});

function verificarEncuestador(user, pass) {
    db.ref('encuestadores').once('value', snapshot => {
        let encontrado = false;
        snapshot.forEach(child => {
            const data = child.val();
            if (data.usuario === user && data.contraseña === pass) {
                encontrado = true;
                currentUser = { 
                    username: user, 
                    name: data.nombre, 
                    role: 'encuestador',
                    id: child.key
                };
                document.getElementById('userNameDisplay').textContent = data.nombre;
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                document.getElementById('loginError').textContent = '';
                mostrarMenuAdmin(false);
                iniciarEscuchaTiempoReal();
                cargarDatosIniciales();
                document.getElementById('censoEncuestador').value = data.nombre;
                showNotification(`✅ Bienvenido ${data.nombre}`, 'success');
            }
        });
        if (!encontrado) {
            document.getElementById('loginError').textContent = 'Usuario o contraseña incorrectos';
        }
    });
}

function mostrarMenuAdmin(esAdmin) {
    document.getElementById('menuAdmin').style.display = esAdmin ? 'block' : 'none';
    document.getElementById('menuReportes').style.display = esAdmin ? 'block' : 'none';
    document.getElementById('btnAdmin').style.display = esAdmin ? 'inline-flex' : 'none';
    document.getElementById('btnReportes').style.display = esAdmin ? 'inline-flex' : 'none';
}

function logout() {
    if (confirm('¿Está seguro que desea salir?')) {
        if (bloquesListener) {
            bloquesListener.off();
            bloquesListener = null;
        }
        if (callesListener) {
            callesListener.off();
            callesListener = null;
        }
        if (encuestadoresListener) {
            encuestadoresListener.off();
            encuestadoresListener = null;
        }
        if (presidentesListener) {
            presidentesListener.off();
            presidentesListener = null;
        }
        if (censoListener) {
            censoListener.off();
            censoListener = null;
        }
        listenersActivos = false;
        selectoresInicializados = false;
        
        currentUser = null;
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginUser').value = '';
        document.getElementById('loginPass').value = '';
        document.getElementById('loginError').textContent = '';
        showNotification('👋 Sesión cerrada correctamente', 'info');
    }
}

// ===== NAVEGACIÓN =====
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    const link = document.querySelector(`.nav-menu a[onclick*="${sectionId}"]`);
    if (link) link.classList.add('active');
    
    if (sectionId === 'reports') {
        cargarDatosReporte();
    }
    if (sectionId === 'adminPanel' && currentUser?.role === 'admin') {
        cargarTodasEncuestas();
        cargarPresidentesUI();
    }
    if (sectionId === 'misEncuestas') {
        cargarMisEncuestas();
    }
}

// ===== MENÚ MÓVIL =====
document.getElementById('navToggle').addEventListener('click', function() {
    document.getElementById('navMenu').classList.toggle('open');
});

// ===== TABS ADMIN =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(this.dataset.tab).classList.add('active');
        
        if (this.dataset.tab === 'tabCalles') cargarCallesUI();
        if (this.dataset.tab === 'tabUsuarios') cargarEncuestadoresUI();
        if (this.dataset.tab === 'tabPresidentes') cargarPresidentesUI();
        if (this.dataset.tab === 'tabEncuestas') cargarTodasEncuestas();
    });
});

// ============================================
// ===== ESCUCHA EN TIEMPO REAL =====
// ============================================

function iniciarEscuchaTiempoReal() {
    if (listenersActivos) return;
    listenersActivos = true;
    
    bloquesListener = db.ref('bloques');
    bloquesListener.on('value', snapshot => {
        bloquesCache = {};
        snapshot.forEach(child => {
            const data = child.val();
            const key = child.key;
            if (!bloquesCache[data.bloque]) {
                bloquesCache[data.bloque] = [];
            }
            bloquesCache[data.bloque].push({ sector: data.sector, key: key });
        });
        Object.keys(bloquesCache).forEach(bloque => {
            bloquesCache[bloque].sort((a, b) => a.sector.localeCompare(b.sector));
        });
        actualizarUI('bloques');
        actualizarSelectoresCenso();
        cargarBloquesParaCalle();
        cargarBloquesParaPresidente();
    });
    
    callesListener = db.ref('calles');
    callesListener.on('value', snapshot => {
        callesCache = {};
        snapshot.forEach(child => {
            const data = child.val();
            const key = child.key;
            const id = `${data.bloque}_${data.sector}_${data.nombre}`;
            callesCache[id] = { ...data, key: key };
        });
        actualizarUI('calles');
        actualizarSelectoresCenso();
    });
    
    encuestadoresListener = db.ref('encuestadores');
    encuestadoresListener.on('value', snapshot => {
        encuestadoresCache = {};
        snapshot.forEach(child => {
            const data = child.val();
            encuestadoresCache[child.key] = data;
        });
        actualizarUI('encuestadores');
        cargarSelectorEncuestadores();
    });
    
    presidentesListener = db.ref('presidentes');
    presidentesListener.on('value', snapshot => {
        presidentesCache = {};
        snapshot.forEach(child => {
            const data = child.val();
            presidentesCache[child.key] = data;
        });
        actualizarUI('presidentes');
        cargarPresidentesUI();
    });
    
    censoListener = db.ref('censo');
    censoListener.on('value', snapshot => {
        censoCache = {};
        snapshot.forEach(child => {
            censoCache[child.key] = child.val();
        });
        actualizarUI('censo');
        actualizarEstadisticas();
        cargarUltimasEncuestas();
        if (document.getElementById('misEncuestas').classList.contains('active')) {
            cargarMisEncuestas();
        }
    });
}

function actualizarUI(tipo) {
    if (tipo === 'bloques' || tipo === 'todos') {
        cargarBloquesUI();
        cargarSectoresUI();
    }
    if (tipo === 'calles' || tipo === 'todos') {
        cargarCallesUI();
    }
    if (tipo === 'encuestadores' || tipo === 'todos') {
        cargarEncuestadoresUI();
        cargarSelectorEncuestadores();
    }
    if (tipo === 'presidentes' || tipo === 'todos') {
        cargarPresidentesUI();
    }
    if (tipo === 'censo' || tipo === 'todos') {
        actualizarEstadisticas();
        cargarUltimasEncuestas();
    }
}

// ===== CARGAR DATOS INICIALES =====
function cargarDatosIniciales() {
    actualizarUI('todos');
    cargarSelectoresCenso();
    if (currentUser?.name) {
        document.getElementById('censoEncuestador').value = currentUser.name;
    }
    
    const inputCedula = document.getElementById('cedula');
    const inputTelefono = document.getElementById('telefono');
    
    inputCedula.addEventListener('input', function() {
        formatearCedula(this);
    });
    
    inputTelefono.addEventListener('input', function() {
        formatearTelefono(this);
    });
    
    inputCedula.addEventListener('paste', function() {
        setTimeout(() => formatearCedula(this), 10);
    });
    
    inputTelefono.addEventListener('paste', function() {
        setTimeout(() => formatearTelefono(this), 10);
    });
    
    setTimeout(() => {
        cargarBloquesParaCalle();
        cargarBloquesParaPresidente();
    }, 500);
}

// ============================================
// ===== SELECTORES DINÁMICOS DEL CENSO =====
// ============================================

function cargarSelectoresCenso() {
    const selectBloque = document.getElementById('censoBloque');
    const selectSector = document.getElementById('censoSector');
    const selectCalle = document.getElementById('censoCalle');
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    const ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    const bloques = Object.keys(bloquesCache).sort((a, b) => 
        ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b)
    );
    
    bloques.forEach(bloque => {
        const opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = `Bloque ${bloque}`;
        selectBloque.appendChild(opt);
    });
    
    const nuevoSelectBloque = selectBloque.cloneNode(true);
    selectBloque.parentNode.replaceChild(nuevoSelectBloque, selectBloque);
    
    const nuevoSelectSector = selectSector.cloneNode(true);
    selectSector.parentNode.replaceChild(nuevoSelectSector, selectSector);
    
    const nuevoSelectCalle = selectCalle.cloneNode(true);
    selectCalle.parentNode.replaceChild(nuevoSelectCalle, selectCalle);
    
    document.getElementById('censoBloque').addEventListener('change', function() {
        cargarSectoresPorBloque(this.value);
    });
    
    document.getElementById('censoSector').addEventListener('change', function() {
        const bloque = document.getElementById('censoBloque').value;
        cargarCallesPorBloqueYSector(bloque, this.value);
    });
    
    if (currentUser?.name) {
        document.getElementById('censoEncuestador').value = currentUser.name;
    }
    
    cargarSelectorEncuestadores();
    selectoresInicializados = true;
}

function cargarSectoresPorBloque(bloque) {
    const selectSector = document.getElementById('censoSector');
    const selectCalle = document.getElementById('censoCalle');
    
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    if (bloque && bloquesCache[bloque]) {
        bloquesCache[bloque].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    }
}

function cargarCallesPorBloqueYSector(bloque, sector) {
    const selectCalle = document.getElementById('censoCalle');
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    if (bloque && sector) {
        const calles = Object.values(callesCache).filter(c => 
            c.bloque === bloque && c.sector === sector
        );
        calles.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        if (calles.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No hay calles registradas';
            selectCalle.appendChild(opt);
        } else {
            calles.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.nombre;
                opt.textContent = c.nombre;
                selectCalle.appendChild(opt);
            });
        }
    }
}

function actualizarSelectoresCenso() {
    if (!selectoresInicializados) {
        cargarSelectoresCenso();
        return;
    }
    
    const selectBloque = document.getElementById('censoBloque');
    const currentBloque = selectBloque.value;
    const ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    const bloques = Object.keys(bloquesCache).sort((a, b) => 
        ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b)
    );
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    bloques.forEach(bloque => {
        const opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = `Bloque ${bloque}`;
        selectBloque.appendChild(opt);
    });
    
    if (currentBloque && bloques.includes(currentBloque)) {
        selectBloque.value = currentBloque;
        cargarSectoresPorBloque(currentBloque);
    } else {
        document.getElementById('censoSector').innerHTML = '<option value="">Seleccionar Sector</option>';
        document.getElementById('censoCalle').innerHTML = '<option value="">Seleccionar Calle</option>';
    }
}

// ============================================
// ===== BLOQUES Y SECTORES =====
// ============================================

function cargarBloquesUI() {
    const container = document.getElementById('bloqueList');
    container.innerHTML = '';
    
    const ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    const sortedBloques = Object.keys(bloquesCache).sort((a, b) => 
        ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b)
    );
    
    if (sortedBloques.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay bloques registrados</p>';
        return;
    }
    
    sortedBloques.forEach(bloque => {
        const sectores = bloquesCache[bloque] || [];
        const sectoresNombres = sectores.map(s => s.sector).join(', ');
        
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">🏛️ Bloque ${bloque}</span>
                <span class="detail">Sectores: ${sectoresNombres || 'Ninguno'}</span>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editarSector('${bloque}')" title="Editar sector">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="eliminarSectorIndividual('${bloque}')" title="Eliminar sector">
                    <i class="fas fa-trash-alt"></i>
                </button>
                <button class="btn-delete" onclick="eliminarBloque('${bloque}')" title="Eliminar bloque completo">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function eliminarSectorIndividual(bloque) {
    const sectores = bloquesCache[bloque] || [];
    if (sectores.length === 0) {
        showNotification('⚠️ No hay sectores para eliminar en este bloque', 'warning');
        return;
    }
    
    let opciones = sectores.map((s, i) => `${i+1}. ${s.sector}`).join('\n');
    const seleccion = prompt(
        `Seleccione el sector a ELIMINAR del Bloque ${bloque}:\n${opciones}\n\nIngrese el número:`
    );
    
    if (!seleccion) return;
    const idx = parseInt(seleccion) - 1;
    if (isNaN(idx) || idx < 0 || idx >= sectores.length) {
        showNotification('❌ Selección inválida', 'error');
        return;
    }
    
    const sector = sectores[idx];
    if (!confirm(`⚠️ ¿Eliminar el sector "${sector.sector}" del Bloque ${bloque}?`)) return;
    
    ejecutarConLoading(() => {
        db.ref('bloques/' + sector.key).remove()
            .then(() => {
                showNotification(`✅ Sector "${sector.sector}" eliminado correctamente`, 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Eliminando sector...');
}

function editarSector(bloque) {
    const sectores = bloquesCache[bloque] || [];
    if (sectores.length === 0) {
        showNotification('⚠️ No hay sectores para editar en este bloque', 'warning');
        return;
    }
    
    let opciones = sectores.map((s, i) => `${i+1}. ${s.sector}`).join('\n');
    const seleccion = prompt(
        `Seleccione el sector a EDITAR del Bloque ${bloque}:\n${opciones}\n\nIngrese el número:`
    );
    
    if (!seleccion) return;
    const idx = parseInt(seleccion) - 1;
    if (isNaN(idx) || idx < 0 || idx >= sectores.length) {
        showNotification('❌ Selección inválida', 'error');
        return;
    }
    
    const sector = sectores[idx];
    const nuevoNombre = prompt(`Editando sector "${sector.sector}" del Bloque ${bloque}\nIngrese el nuevo nombre:`, sector.sector);
    
    if (!nuevoNombre || nuevoNombre.trim() === '') return;
    if (nuevoNombre.trim() === sector.sector) {
        showNotification('⚠️ No se realizaron cambios', 'warning');
        return;
    }
    
    const existe = sectores.some(s => s.sector === nuevoNombre.trim() && s.key !== sector.key);
    if (existe) {
        showNotification('⚠️ Ya existe un sector con ese nombre en este bloque', 'warning');
        return;
    }
    
    ejecutarConLoading(() => {
        const nuevoKey = `${bloque}_${nuevoNombre.trim().replace(/\s/g, '_')}`;
        const data = { bloque: bloque, sector: nuevoNombre.trim() };
        
        db.ref('bloques/' + nuevoKey).set(data)
            .then(() => {
                db.ref('bloques/' + sector.key).remove();
                showNotification(`✅ Sector actualizado a "${nuevoNombre.trim()}"`, 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Actualizando sector...');
}

function eliminarBloque(bloque) {
    if (!confirm(`⚠️ ¿Eliminar TODO el Bloque ${bloque} y TODOS sus sectores?`)) return;
    
    ejecutarConLoading(() => {
        const sectores = bloquesCache[bloque] || [];
        const updates = {};
        sectores.forEach(s => {
            updates[s.key] = null;
        });
        db.ref('bloques').update(updates)
            .then(() => {
                showNotification('✅ Bloque eliminado correctamente', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Eliminando bloque...');
}

function cargarSectoresUI() {
    const select = document.getElementById('calleSectorSelect');
    select.innerHTML = '<option value="">Seleccionar</option>';
    
    Object.keys(bloquesCache).forEach(bloque => {
        const sectores = bloquesCache[bloque] || [];
        sectores.forEach(s => {
            const option = document.createElement('option');
            option.value = s.sector;
            option.textContent = `${s.sector} (Bloque ${bloque})`;
            option.dataset.bloque = bloque;
            option.dataset.key = s.key;
            select.appendChild(option);
        });
    });
}

document.getElementById('bloqueForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const bloque = document.getElementById('bloqueSelect').value;
    const sector = document.getElementById('sectorNombre').value.trim();
    
    if (!bloque || !sector) {
        showNotification('⚠️ Por favor seleccione un bloque y escriba un sector', 'warning');
        return;
    }
    
    const sectores = bloquesCache[bloque] || [];
    const existe = sectores.some(s => s.sector === sector);
    if (existe) {
        showNotification('⚠️ Este sector ya existe en el bloque seleccionado', 'warning');
        return;
    }
    
    ejecutarConLoading(() => {
        const key = `${bloque}_${sector.replace(/\s/g, '_')}`;
        const data = { bloque, sector };
        
        db.ref('bloques/' + key).set(data)
            .then(() => {
                document.getElementById('sectorNombre').value = '';
                document.getElementById('bloqueSelect').value = '';
                showNotification('✅ Bloque y sector guardados correctamente', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Guardando bloque y sector...');
});

// ============================================
// ===== CALLES =====
// ============================================

function cargarCallesUI() {
    const container = document.getElementById('calleList');
    container.innerHTML = '';
    
    const calles = Object.values(callesCache);
    if (calles.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay calles registradas</p>';
        return;
    }
    
    calles.sort((a, b) => a.bloque.localeCompare(b.bloque) || a.sector.localeCompare(b.sector));
    
    calles.forEach(calle => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">📍 ${calle.nombre}</span>
                <span class="detail">Bloque ${calle.bloque} - ${calle.sector}</span>
            </div>
            <div class="item-actions">
                <button class="btn-delete" onclick="eliminarCalle('${calle.key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

document.getElementById('calleForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const bloque = document.getElementById('calleBloqueSelect').value;
    const sector = document.getElementById('calleSectorSelect').value;
    const nombre = document.getElementById('calleNombre').value.trim();
    
    if (!bloque || !sector || !nombre) {
        showNotification('⚠️ Por favor complete todos los campos', 'warning');
        return;
    }
    
    const existe = Object.values(callesCache).some(c => 
        c.bloque === bloque && c.sector === sector && c.nombre === nombre
    );
    if (existe) {
        showNotification('⚠️ Esta calle ya existe en este bloque y sector', 'warning');
        return;
    }
    
    ejecutarConLoading(() => {
        const key = `${bloque}_${sector}_${nombre.replace(/\s/g, '_')}`;
        const data = { bloque, sector, nombre };
        
        db.ref('calles/' + key).set(data)
            .then(() => {
                document.getElementById('calleNombre').value = '';
                showNotification('✅ Calle guardada correctamente', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Guardando calle...');
});

function eliminarCalle(key) {
    if (!confirm('⚠️ ¿Eliminar esta calle?')) return;
    
    ejecutarConLoading(() => {
        db.ref('calles/' + key).remove()
            .then(() => {
                showNotification('✅ Calle eliminada', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Eliminando calle...');
}

// ============================================
// ===== SELECTORES PARA AGREGAR CALLE =====
// ============================================

function cargarBloquesParaCalle() {
    const selectBloque = document.getElementById('calleBloqueSelect');
    if (!selectBloque) return;
    
    const ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    const bloques = Object.keys(bloquesCache).sort((a, b) => 
        ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b)
    );
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    bloques.forEach(bloque => {
        const opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = `Bloque ${bloque}`;
        selectBloque.appendChild(opt);
    });
    
    selectBloque.onchange = function() {
        cargarSectoresParaCalle(this.value);
    };
}

function cargarSectoresParaCalle(bloque) {
    const selectSector = document.getElementById('calleSectorSelect');
    if (!selectSector) return;
    
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    
    if (bloque && bloquesCache[bloque]) {
        bloquesCache[bloque].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    }
}

// ============================================
// ===== ENCUESTADORES =====
// ============================================

function cargarEncuestadoresUI() {
    const container = document.getElementById('encuestadorList');
    container.innerHTML = '';
    
    const keys = Object.keys(encuestadoresCache);
    if (keys.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay encuestadores registrados</p>';
        return;
    }
    
    keys.forEach(key => {
        const data = encuestadoresCache[key];
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">👤 ${data.nombre}</span>
                <span class="detail">Usuario: ${data.usuario} | Registrado por: ${data.registradoPor || 'Admin'}</span>
            </div>
            <div class="item-actions">
                <button class="btn-delete" onclick="eliminarEncuestador('${key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    cargarSelectorEncuestadores();
}

document.getElementById('usuarioForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const nombre = document.getElementById('encuestadorNombre').value.trim();
    const usuario = document.getElementById('encuestadorUser').value.trim();
    const contraseña = document.getElementById('encuestadorPass').value.trim();
    
    if (!nombre || !usuario || !contraseña) {
        showNotification('⚠️ Por favor complete todos los campos', 'warning');
        return;
    }
    
    ejecutarConLoading(() => {
        const key = `encuestador_${Date.now()}`;
        const data = { 
            nombre, 
            usuario, 
            contraseña, 
            registradoPor: currentUser?.name || 'Admin',
            fechaRegistro: new Date().toISOString()
        };
        
        db.ref('encuestadores/' + key).set(data)
            .then(() => {
                document.getElementById('encuestadorNombre').value = '';
                document.getElementById('encuestadorUser').value = '';
                document.getElementById('encuestadorPass').value = '';
                showNotification('✅ Encuestador registrado correctamente', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Registrando encuestador...');
});

function eliminarEncuestador(key) {
    if (!confirm('⚠️ ¿Eliminar este encuestador?')) return;
    
    ejecutarConLoading(() => {
        db.ref('encuestadores/' + key).remove()
            .then(() => {
                showNotification('✅ Encuestador eliminado', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Eliminando encuestador...');
}

function cargarSelectorEncuestadores() {
    const select = document.getElementById('censoEncuestador');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar Encuestador</option>';
    Object.values(encuestadoresCache).forEach(data => {
        const opt = document.createElement('option');
        opt.value = data.nombre;
        opt.textContent = data.nombre;
        select.appendChild(opt);
    });
    if (currentUser?.name) {
        select.value = currentUser.name;
    }
}

// ============================================
// ===== PRESIDENTES DE COMITÉ - CORREGIDO =====
// ============================================

function cargarBloquesParaPresidente() {
    const selectBloque = document.getElementById('presidenteBloque');
    if (!selectBloque) return;
    
    const ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    const bloques = Object.keys(bloquesCache).sort((a, b) => 
        ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b)
    );
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    bloques.forEach(bloque => {
        const opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = `Bloque ${bloque}`;
        selectBloque.appendChild(opt);
    });
    
    selectBloque.onchange = function() {
        cargarSectoresParaPresidente(this.value);
    };
}

function cargarSectoresParaPresidente(bloque) {
    const selectSector = document.getElementById('presidenteSector');
    if (!selectSector) return;
    
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    
    if (bloque && bloquesCache[bloque]) {
        bloquesCache[bloque].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    }
}

document.getElementById('presidenteForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const bloque = document.getElementById('presidenteBloque').value;
    const sector = document.getElementById('presidenteSector').value;
    const nombre = document.getElementById('presidenteNombre').value.trim().toUpperCase();
    const cedula = document.getElementById('presidenteCedula').value.trim();
    
    if (!bloque || !sector || !nombre) {
        showNotification('⚠️ Por favor complete todos los campos', 'warning');
        return;
    }
    
    const existe = Object.values(presidentesCache).some(p => 
        p.bloque === bloque && p.sector === sector
    );
    if (existe) {
        showNotification('⚠️ Ya existe un presidente para este bloque y sector', 'warning');
        return;
    }
    
    ejecutarConLoading(() => {
        const key = `presidente_${Date.now()}`;
        const data = { 
            bloque, 
            sector, 
            nombre,
            cedula: cedula || '',
            registradoPor: currentUser?.name || 'Admin',
            fechaRegistro: new Date().toISOString()
        };
        
        db.ref('presidentes/' + key).set(data)
            .then(() => {
                document.getElementById('presidenteNombre').value = '';
                document.getElementById('presidenteCedula').value = '';
                document.getElementById('presidenteBloque').value = '';
                document.getElementById('presidenteSector').innerHTML = '<option value="">Seleccionar</option>';
                showNotification('✅ Presidente de comité registrado correctamente', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Registrando presidente...');
});

function cargarPresidentesUI() {
    const container = document.getElementById('presidenteList');
    container.innerHTML = '';
    
    const keys = Object.keys(presidentesCache);
    if (keys.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay presidentes de comité registrados</p>';
        return;
    }
    
    keys.forEach(key => {
        const data = presidentesCache[key];
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">👔 ${data.nombre}</span>
                <span class="detail">Bloque ${data.bloque} - ${data.sector} | Cédula: ${data.cedula || 'N/A'}</span>
                <span class="detail">Registrado por: ${data.registradoPor || 'Admin'}</span>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editarPresidente('${key}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="eliminarPresidente('${key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function eliminarPresidente(key) {
    if (!confirm('⚠️ ¿Eliminar este presidente de comité?')) return;
    
    ejecutarConLoading(() => {
        db.ref('presidentes/' + key).remove()
            .then(() => {
                showNotification('✅ Presidente eliminado correctamente', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Eliminando presidente...');
}

function editarPresidente(key) {
    const data = presidentesCache[key];
    if (!data) {
        showNotification('❌ No se encontraron datos', 'error');
        return;
    }
    
    const nuevoNombre = prompt(`Editando presidente del Bloque ${data.bloque} - ${data.sector}\nNombre actual: ${data.nombre}\nIngrese el nuevo nombre:`, data.nombre);
    if (!nuevoNombre || nuevoNombre.trim() === '') return;
    
    const nuevaCedula = prompt(`Cédula actual: ${data.cedula || 'N/A'}\nIngrese la nueva cédula:`, data.cedula || '');
    
    ejecutarConLoading(() => {
        const updates = {
            nombre: nuevoNombre.trim().toUpperCase(),
            cedula: nuevaCedula ? nuevaCedula.trim() : '',
            editadoPor: currentUser?.name || 'Admin',
            fechaEdicion: new Date().toISOString()
        };
        
        db.ref('presidentes/' + key).update(updates)
            .then(() => {
                showNotification('✅ Presidente actualizado correctamente', 'success');
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Actualizando presidente...');
}

// ===== FUNCIÓN MEJORADA PARA OBTENER PRESIDENTE POR SECTOR =====
function getPresidentePorSector(bloque, sector) {
    console.log('=== BUSCANDO PRESIDENTE ===');
    console.log('Bloque:', bloque);
    console.log('Sector:', sector);
    console.log('Presidentes en caché:', presidentesCache);
    
    // Buscar en presidentesCache
    const presidentes = Object.values(presidentesCache);
    console.log('Array de presidentes:', presidentes);
    
    const encontrado = presidentes.find(p => {
        console.log('Comparando:', p.bloque, '===', bloque, 'y', p.sector, '===', sector);
        return p.bloque === bloque && p.sector === sector;
    });
    
    console.log('Presidente encontrado:', encontrado);
    return encontrado || null;
}

// ============================================
// ===== CENSO (Encuestas) =====
// ============================================

document.getElementById('censusFormData').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const cedula = document.getElementById('cedula').value.trim();
    const encuestador = currentUser?.name || document.getElementById('censoEncuestador').value || 'Desconocido';
    
    const existe = Object.values(censoCache).some(d => d.cedula === cedula && !window.editKey);
    if (existe) {
        showNotification('⚠️ Esta cédula ya está registrada. Cada persona debe tener un registro único.', 'warning');
        return;
    }
    
    const data = {
        cedula: cedula,
        nombre: document.getElementById('nombreCompleto').value.trim().toUpperCase(),
        sexo: document.getElementById('sexo').value,
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim().toUpperCase(),
        bloque: document.getElementById('censoBloque').value,
        sector: document.getElementById('censoSector').value,
        calle: document.getElementById('censoCalle').value.toUpperCase(),
        encuestador: encuestador,
        fecha: new Date().toISOString(),
        fechaRegistro: new Date().toLocaleString(),
        registradoPor: currentUser?.name || 'Desconocido'
    };
    
    if (!data.cedula || !data.nombre || !data.sexo || !data.direccion || 
        !data.bloque || !data.sector || !data.calle) {
        showNotification('⚠️ Por favor complete todos los campos obligatorios (*)', 'warning');
        return;
    }
    
    ejecutarConLoading(() => {
        const key = `censo_${Date.now()}`;
        db.ref('censo/' + key).set(data)
            .then(() => {
                document.getElementById('censusFormData').reset();
                document.getElementById('censoBloque').value = '';
                document.getElementById('censoSector').innerHTML = '<option value="">Seleccionar Sector</option>';
                document.getElementById('censoCalle').innerHTML = '<option value="">Seleccionar Calle</option>';
                document.getElementById('censoEncuestador').value = encuestador;
                showNotification('✅ Encuesta guardada correctamente', 'success');
                window.editKey = null;
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Guardando encuesta...');
});

function cargarUltimasEncuestas() {
    const container = document.getElementById('ultimasEncuestas');
    container.innerHTML = '';
    
    const items = Object.values(censoCache);
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay encuestas registradas</p>';
        return;
    }
    
    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const ultimas = items.slice(0, 10);
    
    ultimas.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">${item.nombre}</span>
                <span class="detail">📋 Cédula: ${item.cedula} | ${item.sector}, Bloque ${item.bloque}</span>
                <span class="detail">👤 Encuestador: ${item.encuestador} | 📅 ${item.fechaRegistro || new Date(item.fecha).toLocaleString()}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

// ============================================
// ===== MIS ENCUESTAS =====
// ============================================

function cargarMisEncuestas() {
    if (!currentUser?.name) return;
    
    const container = document.getElementById('listaMisEncuestas');
    container.innerHTML = '';
    
    const items = Object.values(censoCache).filter(d => d.encuestador === currentUser.name);
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No has realizado encuestas</p>';
        return;
    }
    
    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    items.forEach(item => {
        const key = Object.keys(censoCache).find(k => censoCache[k] === item);
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">${item.nombre}</span>
                <span class="detail">📋 Cédula: ${item.cedula} | ${item.sector}, Bloque ${item.bloque}</span>
                <span class="detail">📍 ${item.direccion} | 📞 ${item.telefono || 'N/A'}</span>
                <span class="detail">📅 ${item.fechaRegistro || new Date(item.fecha).toLocaleString()}</span>
            </div>
            <div class="item-actions">
                <button class="btn-delete" onclick="eliminarMiEncuesta('${key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function buscarMisEncuestas() {
    const cedula = document.getElementById('misBuscarCedula').value.trim().toLowerCase();
    const nombre = document.getElementById('misBuscarNombre').value.trim().toLowerCase();
    
    if (!cedula && !nombre) {
        cargarMisEncuestas();
        return;
    }
    
    const container = document.getElementById('listaMisEncuestas');
    container.innerHTML = '';
    
    const items = Object.values(censoCache).filter(d => {
        if (d.encuestador !== currentUser.name) return false;
        const matchCedula = !cedula || d.cedula?.toLowerCase().includes(cedula);
        const matchNombre = !nombre || d.nombre?.toLowerCase().includes(nombre);
        return matchCedula && matchNombre;
    });
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No se encontraron encuestas</p>';
        return;
    }
    
    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    items.forEach(item => {
        const key = Object.keys(censoCache).find(k => censoCache[k] === item);
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">${item.nombre}</span>
                <span class="detail">📋 Cédula: ${item.cedula} | ${item.sector}, Bloque ${item.bloque}</span>
                <span class="detail">📍 ${item.direccion} | 📞 ${item.telefono || 'N/A'}</span>
                <span class="detail">📅 ${item.fechaRegistro || new Date(item.fecha).toLocaleString()}</span>
            </div>
            <div class="item-actions">
                <button class="btn-delete" onclick="eliminarMiEncuesta('${key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function eliminarMiEncuesta(key) {
    if (!confirm('⚠️ ¿Eliminar esta encuesta permanentemente?')) return;
    
    ejecutarConLoading(() => {
        db.ref('censo/' + key).remove()
            .then(() => {
                showNotification('✅ Encuesta eliminada correctamente', 'success');
                cargarMisEncuestas();
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Eliminando encuesta...');
}

// ============================================
// ===== ADMIN: GESTIÓN DE ENCUESTAS =====
// ============================================

function cargarTodasEncuestas() {
    document.getElementById('buscarCedula').value = '';
    document.getElementById('buscarNombre').value = '';
    cargarEncuestasFiltradas();
}

function buscarEncuestas() {
    cargarEncuestasFiltradas();
}

function cargarEncuestasFiltradas() {
    const cedula = document.getElementById('buscarCedula').value.trim().toLowerCase();
    const nombre = document.getElementById('buscarNombre').value.trim().toLowerCase();
    
    const container = document.getElementById('listaEncuestasAdmin');
    container.innerHTML = '';
    
    let items = Object.values(censoCache);
    if (cedula || nombre) {
        items = items.filter(d => {
            const matchCedula = !cedula || d.cedula?.toLowerCase().includes(cedula);
            const matchNombre = !nombre || d.nombre?.toLowerCase().includes(nombre);
            return matchCedula && matchNombre;
        });
    }
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No se encontraron encuestas</p>';
        return;
    }
    
    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    items.forEach(item => {
        const key = Object.keys(censoCache).find(k => censoCache[k] === item);
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">${item.nombre}</span>
                <span class="detail">📋 Cédula: ${item.cedula} | ${item.sector}, Bloque ${item.bloque}</span>
                <span class="detail">📍 ${item.direccion} | 📞 ${item.telefono || 'N/A'}</span>
                <span class="detail">👤 Encuestador: ${item.encuestador} | 📅 ${item.fechaRegistro || new Date(item.fecha).toLocaleString()}</span>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editarEncuesta('${key}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="eliminarEncuesta('${key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function eliminarEncuesta(key) {
    if (!confirm('⚠️ ¿Eliminar esta encuesta permanentemente?')) return;
    
    ejecutarConLoading(() => {
        db.ref('censo/' + key).remove()
            .then(() => {
                showNotification('✅ Encuesta eliminada correctamente', 'success');
                cargarTodasEncuestas();
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Eliminando encuesta...');
}

function editarEncuesta(key) {
    const data = censoCache[key];
    if (!data) {
        showNotification('❌ No se encontraron datos', 'error');
        return;
    }
    
    document.getElementById('cedula').value = data.cedula || '';
    document.getElementById('nombreCompleto').value = data.nombre || '';
    document.getElementById('sexo').value = data.sexo || '';
    document.getElementById('telefono').value = data.telefono || '';
    document.getElementById('direccion').value = data.direccion || '';
    document.getElementById('censoBloque').value = data.bloque || '';
    document.getElementById('censoEncuestador').value = data.encuestador || currentUser?.name || '';
    
    setTimeout(() => {
        if (data.bloque) {
            cargarSectoresPorBloque(data.bloque);
            setTimeout(() => {
                document.getElementById('censoSector').value = data.sector || '';
                if (data.sector && data.bloque) {
                    cargarCallesPorBloqueYSector(data.bloque, data.sector);
                    setTimeout(() => {
                        document.getElementById('censoCalle').value = data.calle || '';
                    }, 200);
                }
            }, 200);
        }
    }, 300);
    
    window.editKey = key;
    
    const submitBtn = document.querySelector('#censusFormData button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Encuesta';
    submitBtn.onclick = function(e) {
        e.preventDefault();
        actualizarEncuesta(key);
    };
    
    showSection('censusForm');
    showNotification('📝 Editando encuesta - Modifique los datos y presione "Actualizar Encuesta"', 'info', 4000);
}

function actualizarEncuesta(key) {
    const cedula = document.getElementById('cedula').value.trim();
    
    const duplicado = Object.values(censoCache).some(d => d.cedula === cedula && Object.keys(censoCache).find(k => censoCache[k] === d) !== key);
    if (duplicado) {
        showNotification('⚠️ Esta cédula ya está registrada. Cada persona debe tener un registro único.', 'warning');
        return;
    }
    
    const data = {
        cedula: cedula,
        nombre: document.getElementById('nombreCompleto').value.trim().toUpperCase(),
        sexo: document.getElementById('sexo').value,
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim().toUpperCase(),
        bloque: document.getElementById('censoBloque').value,
        sector: document.getElementById('censoSector').value,
        calle: document.getElementById('censoCalle').value.toUpperCase(),
        encuestador: document.getElementById('censoEncuestador').value || currentUser?.name || 'Desconocido',
        fecha: new Date().toISOString(),
        fechaRegistro: new Date().toLocaleString(),
        registradoPor: currentUser?.name || 'Desconocido',
        editado: true,
        editadoPor: currentUser?.name || 'Admin',
        fechaEdicion: new Date().toLocaleString()
    };
    
    if (!data.cedula || !data.nombre || !data.sexo || !data.direccion || 
        !data.bloque || !data.sector || !data.calle) {
        showNotification('⚠️ Por favor complete todos los campos obligatorios (*)', 'warning');
        return;
    }
    
    ejecutarConLoading(() => {
        db.ref('censo/' + key).update(data)
            .then(() => {
                const submitBtn = document.querySelector('#censusFormData button[type="submit"]');
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Guardar Encuesta';
                submitBtn.onclick = function(e) {
                    e.preventDefault();
                    document.getElementById('censusFormData').dispatchEvent(new Event('submit'));
                };
                
                document.getElementById('censusFormData').reset();
                document.getElementById('censoBloque').value = '';
                document.getElementById('censoSector').innerHTML = '<option value="">Seleccionar Sector</option>';
                document.getElementById('censoCalle').innerHTML = '<option value="">Seleccionar Calle</option>';
                document.getElementById('censoEncuestador').value = currentUser?.name || '';
                showNotification('✅ Encuesta actualizada correctamente', 'success');
                window.editKey = null;
            })
            .catch(error => showNotification('❌ Error: ' + error.message, 'error'));
    }, 'Actualizando encuesta...');
}

// ============================================
// ===== ESTADÍSTICAS =====
// ============================================

function actualizarEstadisticas() {
    document.getElementById('totalCensados').textContent = Object.keys(censoCache).length;
    
    const bloquesSet = new Set();
    Object.keys(bloquesCache).forEach(b => bloquesSet.add(b));
    document.getElementById('totalBloques').textContent = bloquesSet.size;
    
    document.getElementById('totalCalles').textContent = Object.keys(callesCache).length;
    document.getElementById('totalEncuestadores').textContent = Object.keys(encuestadoresCache).length;
}

// ============================================
// ===== REPORTES =====
// ============================================

document.getElementById('reportType').addEventListener('change', function() {
    const tipo = this.value;
    document.getElementById('reportBloqueGroup').style.display = tipo === 'bloque' ? 'block' : 'none';
    document.getElementById('reportSectorGroup').style.display = tipo === 'sector' ? 'block' : 'none';
    
    if (tipo === 'bloque' || tipo === 'sector') {
        cargarSelectoresReporte();
    }
});

function cargarSelectoresReporte() {
    const selectBloque = document.getElementById('reportBloque');
    selectBloque.innerHTML = '<option value="">Seleccionar</option>';
    const ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    const bloques = Object.keys(bloquesCache).sort((a, b) => 
        ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b)
    );
    bloques.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = `🏛️ Bloque ${b}`;
        selectBloque.appendChild(opt);
    });
}

document.getElementById('reportBloque').addEventListener('change', function() {
    const bloque = this.value;
    const sectorSelect = document.getElementById('reportSector');
    sectorSelect.innerHTML = '<option value="">Seleccionar</option>';
    
    if (bloque && bloquesCache[bloque]) {
        bloquesCache[bloque].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            sectorSelect.appendChild(opt);
        });
    }
});

function cargarDatosReporte() {
    cargarSelectoresReporte();
}

function getColumnasSeleccionadas() {
    const checkboxes = document.querySelectorAll('.col-check:checked');
    const columnas = [];
    checkboxes.forEach(cb => {
        columnas.push(cb.value);
    });
    return columnas;
}

function generarReporte(tipo) {
    const columnas = getColumnasSeleccionadas();
    if (columnas.length === 0) {
        showNotification('⚠️ Seleccione al menos una columna para el reporte', 'warning');
        return;
    }
    
    const reportType = document.getElementById('reportType').value;
    let datos = Object.values(censoCache);
    let titulo = 'Todos los Sectores';
    
    if (reportType === 'bloque') {
        const bloque = document.getElementById('reportBloque').value;
        if (!bloque) { showNotification('⚠️ Seleccione un bloque', 'warning'); return; }
        datos = datos.filter(d => d.bloque === bloque);
        titulo = `Bloque ${bloque}`;
    } else if (reportType === 'sector') {
        const sector = document.getElementById('reportSector').value;
        if (!sector) { showNotification('⚠️ Seleccione un sector', 'warning'); return; }
        datos = datos.filter(d => d.sector === sector);
        titulo = `Sector: ${sector}`;
    }
    
    if (datos.length === 0) {
        showNotification('⚠️ No hay datos para generar el reporte', 'warning');
        return;
    }
    
    datos.sort((a, b) => {
        const calleA = a.calle || '';
        const calleB = b.calle || '';
        if (calleA !== calleB) {
            return calleA.localeCompare(calleB);
        }
        const nombreA = a.nombre || '';
        const nombreB = b.nombre || '';
        return nombreA.localeCompare(nombreB);
    });
    
    mostrarVistaPrevia(datos, titulo, columnas);
    
    if (tipo === 'excel') {
        exportarExcel(datos, titulo, columnas);
    } else {
        exportarPDF(datos, titulo, columnas);
    }
}

// ============================================
// ===== VISTA PREVIA =====
// ============================================

function mostrarVistaPrevia(datos, titulo, columnas) {
    const container = document.getElementById('reportPreview');
    const headersMap = {
        no: 'No.',
        cedula: 'Cédula',
        nombre: 'Nombre',
        sexo: 'Sexo',
        telefono: 'Teléfono',
        direccion: 'Dirección',
        bloque: 'Bloque',
        sector: 'Sector',
        calle: 'Calle',
        encuestador: 'Encuestador',
        fecha: 'Fecha',
        registradoPor: 'Registrado por'
    };
    
    let html = `
        <div style="
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        ">
            <div style="
                text-align: center;
                border-bottom: 2px solid #B8860B;
                padding-bottom: 10px;
                margin-bottom: 15px;
            ">
                <h3 style="color: #1a3c5e; margin: 0;">JUNTA MUNICIPAL SAN LUIS</h3>
                <p style="color: #6b7a8f; margin: 0; font-size: 0.9rem;">DEPARTAMENTO DE ASUNTOS COMUNITARIOS</p>
                <p style="color: #B8860B; margin: 0; font-weight: bold;">REPORTE DE CENSO ELECTORAL</p>
            </div>
            <div style="
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 0.9rem;
            ">
                <span><strong>Reporte:</strong> ${titulo}</span>
                <span><strong>Total:</strong> ${datos.length} registros</span>
                <span><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</span>
            </div>
            <div style="
                overflow-x: auto;
                max-height: 400px;
                overflow-y: auto;
            ">
                <table style="
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                    min-width: 600px;
                ">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr style="background: #1a3c5e; color: white;">
                            <th style="padding: 8px 10px; border: 1px solid #c5cdd8; text-align: center; white-space: nowrap;">No.</th>
    `;
    
    columnas.forEach(col => {
        html += `<th style="padding: 8px 10px; border: 1px solid #c5cdd8; text-align: left; white-space: nowrap;">${headersMap[col] || col}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    datos.slice(0, 10).forEach((d, index) => {
        html += '<tr style="border-bottom: 1px solid #f0f0f0;">';
        html += `<td style="padding: 6px 10px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold;">${index + 1}</td>`;
        columnas.forEach(col => {
            let valor = d[col] || '';
            if (col !== 'cedula' && col !== 'telefono' && col !== 'fecha') {
                valor = valor.toUpperCase();
            }
            html += `<td style="padding: 6px 10px; border: 1px solid #e0e0e0; max-width: 150px; word-wrap: break-word;">${valor}</td>`;
        });
        html += '</tr>';
    });
    
    if (datos.length > 10) {
        html += `<tr><td colspan="${columnas.length + 1}" style="text-align:center;color:var(--gray-dark);padding:10px;border: 1px solid #e0e0e0;">
            ... y ${datos.length - 10} registros más
        </td></tr>`;
    }
    
    html += `
                </tbody></table>
            </div>
            <div style="
                margin-top: 15px;
                padding-top: 10px;
                border-top: 2px solid #B8860B;
                display: flex;
                justify-content: space-between;
                font-size: 0.85rem;
            ">
                <div>
                    <strong>Director:</strong> Francisco Lorenzo
                </div>
                <div>
                    <strong>Encargado:</strong> Domingo Carsado
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// ============================================
// ===== EXPORTAR EXCEL =====
// ============================================

function exportarExcel(datos, titulo, columnas) {
    const headersMap = {
        cedula: 'Cédula',
        nombre: 'Nombre',
        sexo: 'Sexo',
        telefono: 'Teléfono',
        direccion: 'Dirección',
        bloque: 'Bloque',
        sector: 'Sector',
        calle: 'Calle',
        encuestador: 'Encuestador',
        fecha: 'Fecha',
        registradoPor: 'Registrado por'
    };
    
    const headers = ['No.', ...columnas.map(col => headersMap[col] || col)];
    const rows = [headers];
    
    datos.forEach((d, index) => {
        const row = [index + 1];
        columnas.forEach(col => {
            let valor = d[col] || '';
            if (col === 'fecha') {
                valor = d.fechaRegistro || new Date(d.fecha).toLocaleString() || '';
            } else if (col !== 'cedula' && col !== 'telefono') {
                valor = valor.toUpperCase();
            }
            row.push(valor);
        });
        rows.push(row);
    });
    
    let csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Censo_JMSL_${titulo.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showNotification('✅ Reporte Excel generado correctamente', 'success');
}

// ============================================
// ===== EXPORTAR PDF - TAMAÑO CARTA HORIZONTAL =====
// ============================================

function exportarPDF(datos, titulo, columnas) {
    const { jsPDF } = window.jspdf;
    
    // ===== TAMAÑO CARTA (8.5 x 11 pulgadas) HORIZONTAL =====
    const doc = new jsPDF('landscape', 'mm', [279.4, 215.9]); // Ancho x Alto en mm
    
    const pageWidth = 279.4;  // Ancho de carta horizontal
    const pageHeight = 215.9; // Alto de carta horizontal
    const margin = 10;
    let pageCount = 1;
    
    const headersMap = {
        cedula: 'CÉDULA',
        nombre: 'NOMBRE',
        sexo: 'SEXO',
        telefono: 'TELÉFONO',
        direccion: 'DIRECCIÓN',
        bloque: 'BLOQUE',
        sector: 'SECTOR',
        calle: 'CALLE',
        encuestador: 'ENCUESTADOR',
        fecha: 'FECHA',
        registradoPor: 'REGISTRADO POR'
    };
    
    // ===== SOLO LAS COLUMNAS SELECCIONADAS =====
    const headers = ['No.', ...columnas.map(col => headersMap[col] || col.toUpperCase())];
    
    // ===== DEFINIR ANCHOS DE COLUMNAS =====
    const colWidths = {
        no: 12,
        cedula: 28,
        nombre: 38,
        sexo: 20,
        telefono: 24,
        direccion: 42,
        bloque: 16,
        sector: 28,
        calle: 30,
        encuestador: 32,
        fecha: 28,
        registradoPor: 28
    };
    
    // ===== CALCULAR ANCHOS =====
    const colWidthsArray = [];
    headers.forEach((h, i) => {
        if (i === 0) {
            colWidthsArray.push(colWidths.no);
        } else {
            const colKey = columnas[i - 1];
            colWidthsArray.push(colWidths[colKey] || 25);
        }
    });
    
    let totalTableWidth = colWidthsArray.reduce((a, b) => a + b, 0);
    const availableWidth = pageWidth - margin * 2;
    
    let finalColWidths = [...colWidthsArray];
    if (totalTableWidth > availableWidth) {
        const factor = availableWidth / totalTableWidth;
        finalColWidths = colWidthsArray.map(w => Math.floor(w * factor));
    }
    
    // ===== DIBUJAR ENCABEZADO DEL DOCUMENTO =====
    function dibujarEncabezado(doc) {
        try {
            const logoImg = document.querySelector('.nav-logo')?.src || '';
            if (logoImg) {
                const logoWidth = 20;
                const logoHeight = 20;
                const xLogo = (pageWidth - logoWidth) / 2;
                doc.addImage(logoImg, 'PNG', xLogo, 2, logoWidth, logoHeight);
            }
        } catch(e) {}
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('JUNTA MUNICIPAL SAN LUIS', pageWidth/2, 25, { align: 'center' });
        
        doc.setFontSize(8);
        doc.text('RNC: 4-30-017809', pageWidth/2, 30, { align: 'center' });
        doc.text('MUNICIPIO: SANTO DOMINGO ESTE - PROVINCIA: SANTO DOMINGO', pageWidth/2, 34, { align: 'center' });
        doc.text('DEPARTAMENTO DE ASUNTOS COMUNITARIOS', pageWidth/2, 38, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text('REPORTE DE CENSO ELECTORAL', pageWidth/2, 44, { align: 'center' });
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`REPORTE: ${titulo.toUpperCase()}`, pageWidth/2, 50, { align: 'center' });
        doc.text(`FECHA: ${new Date().toLocaleDateString()}`, pageWidth/2, 54, { align: 'center' });
        doc.text(`TOTAL DE REGISTROS: ${datos.length}`, pageWidth/2, 58, { align: 'center' });
        
        return 64;
    }
    
    // ===== DIBUJAR TABLA CON BORDES =====
    function dibujarTabla(doc, startY, datosSlice) {
        let currentY = startY;
        const rowHeight = 5;
        const headerHeight = 7;
        const tableWidth = finalColWidths.reduce((a, b) => a + b, 0);
        
        // --- ENCABEZADO DE TABLA ---
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        
        doc.setFillColor(26, 60, 94);
        doc.rect(margin, currentY, tableWidth, headerHeight, 'F');
        
        doc.setTextColor(255, 255, 255);
        let xPos = margin;
        headers.forEach((h, i) => {
            doc.text(h, xPos + 1.5, currentY + 3.5);
            xPos += finalColWidths[i];
        });
        doc.setTextColor(0, 0, 0);
        
        doc.setDrawColor(26, 60, 94);
        xPos = margin;
        headers.forEach((h, i) => {
            doc.rect(xPos, currentY, finalColWidths[i], headerHeight);
            xPos += finalColWidths[i];
        });
        
        currentY += headerHeight;
        
        // --- DATOS DE LA TABLA ---
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        
        datosSlice.forEach((d, idx) => {
            const globalIdx = datos.indexOf(d);
            const isEven = idx % 2 === 0;
            
            const row = [String(globalIdx + 1)];
            columnas.forEach(col => {
                let valor = d[col] || '';
                if (col === 'fecha') {
                    valor = d.fechaRegistro || new Date(d.fecha).toLocaleString() || '';
                } else if (col !== 'cedula' && col !== 'telefono') {
                    valor = valor.toUpperCase();
                }
                row.push(valor);
            });
            
            let maxLines = 1;
            let rowData = [];
            row.forEach((text, i) => {
                const maxWidth = finalColWidths[i] - 3;
                const lines = doc.splitTextToSize(text, maxWidth);
                rowData.push(lines);
                if (lines.length > maxLines) maxLines = lines.length;
            });
            
            const rowHeightDynamic = Math.max(rowHeight, maxLines * 4.5 + 1.5);
            
            if (isEven) {
                doc.setFillColor(248, 248, 248);
            } else {
                doc.setFillColor(255, 255, 255);
            }
            doc.rect(margin, currentY, tableWidth, rowHeightDynamic, 'F');
            
            for (let line = 0; line < maxLines; line++) {
                rowData.forEach((lines, i) => {
                    const x = margin + finalColWidths.slice(0, i).reduce((a, b) => a + b, 0);
                    const y = currentY + 2 + (line * 4.5);
                    const text = lines[line] || '';
                    doc.text(text, x + 1.5, y);
                });
            }
            
            doc.setDrawColor(200, 200, 200);
            xPos = margin;
            headers.forEach((h, i) => {
                doc.rect(xPos, currentY, finalColWidths[i], rowHeightDynamic);
                xPos += finalColWidths[i];
            });
            
            currentY += rowHeightDynamic;
        });
        
        return currentY;
    }
    
    // ===== DIBUJAR PIE DE PÁGINA =====
    function dibujarPiePagina(doc, pageNum) {
        const y = pageHeight - 5;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${pageNum}`, pageWidth/2, y, { align: 'center' });
    }
    
    // ===== GENERAR PDF CON CONTROL DE PÁGINAS =====
    let startY = dibujarEncabezado(doc);
    let currentIndex = 0;
    const totalRows = datos.length;
    const pageHeightAvailable = pageHeight - 15;
    
    while (currentIndex < totalRows) {
        // Calcular cuántas filas caben en esta página
        let tempY = startY;
        let rowCount = 0;
        let tempSlice = [];
        let headerAdded = false;
        
        for (let i = currentIndex; i < totalRows; i++) {
            const d = datos[i];
            
            // Calcular altura de esta fila
            const row = [String(i + 1)];
            columnas.forEach(col => {
                let valor = d[col] || '';
                if (col === 'fecha') {
                    valor = d.fechaRegistro || new Date(d.fecha).toLocaleString() || '';
                } else if (col !== 'cedula' && col !== 'telefono') {
                    valor = valor.toUpperCase();
                }
                row.push(valor);
            });
            
            let maxLines = 1;
            row.forEach((text, j) => {
                const maxWidth = finalColWidths[j] - 3;
                const lines = doc.splitTextToSize(text, maxWidth);
                if (lines.length > maxLines) maxLines = lines.length;
            });
            
            const rowHeightDynamic = Math.max(5, maxLines * 4.5 + 1.5);
            
            // Verificar si cabe
            if (!headerAdded) {
                // Primera fila: incluir espacio del encabezado
                if (tempY + 7 + rowHeightDynamic + 2 > pageHeightAvailable) {
                    break;
                }
                tempY += 7; // Espacio del encabezado
                headerAdded = true;
            } else {
                if (tempY + rowHeightDynamic + 2 > pageHeightAvailable) {
                    break;
                }
            }
            
            tempY += rowHeightDynamic + 1;
            rowCount++;
            tempSlice.push(d);
        }
        
        // Si no cabe ninguna fila, forzar al menos una
        if (tempSlice.length === 0 && currentIndex < totalRows) {
            tempSlice.push(datos[currentIndex]);
            rowCount = 1;
            // Reiniciar Y
            tempY = startY + 7;
        }
        
        // Dibujar la tabla
        startY = dibujarTabla(doc, startY, tempSlice);
        currentIndex += tempSlice.length;
        
        // Si hay más datos, nueva página
        if (currentIndex < totalRows) {
            dibujarPiePagina(doc, pageCount);
            doc.addPage();
            pageCount++;
            startY = dibujarEncabezado(doc);
        }
    }
    
    // Último pie de página
    dibujarPiePagina(doc, pageCount);
    
    doc.save(`Censo_JMSL_${titulo.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    showNotification('✅ Reporte PDF generado correctamente', 'success');
}
// ============================================
// ===== TABLA DE FIRMAS - CORREGIDA CON PRESIDENTE =====
// ============================================

function imprimirTablaFirmas() {
    const reportType = document.getElementById('reportType').value;
    let datos = Object.values(censoCache);
    let titulo = 'Todos los Sectores';
    let bloqueSeleccionado = '';
    let sectorSeleccionado = '';
    
    if (reportType === 'bloque') {
        const bloque = document.getElementById('reportBloque').value;
        if (!bloque) { showNotification('⚠️ Seleccione un bloque', 'warning'); return; }
        datos = datos.filter(d => d.bloque === bloque);
        titulo = `Bloque ${bloque}`;
        bloqueSeleccionado = bloque;
    } else if (reportType === 'sector') {
        const sector = document.getElementById('reportSector').value;
        if (!sector) { showNotification('⚠️ Seleccione un sector', 'warning'); return; }
        const bloque = document.getElementById('reportBloque').value;
        datos = datos.filter(d => d.sector === sector);
        titulo = `Sector: ${sector}`;
        sectorSeleccionado = sector;
        bloqueSeleccionado = bloque;
    }
    
    if (datos.length === 0) {
        showNotification('⚠️ No hay datos para generar la tabla de firmas', 'warning');
        return;
    }
    
    // ===== BUSCAR PRESIDENTE DEL SECTOR =====
    let presidente = null;
    
    // PRIMERO: Buscar por bloque y sector específico
    if (bloqueSeleccionado && sectorSeleccionado) {
        presidente = getPresidentePorSector(bloqueSeleccionado, sectorSeleccionado);
    }
    
    // SEGUNDO: Si no se encontró y hay bloque, buscar cualquier presidente del bloque
    if (!presidente && bloqueSeleccionado) {
        const presidentes = Object.values(presidentesCache);
        for (const p of presidentes) {
            if (p.bloque === bloqueSeleccionado) {
                presidente = p;
                break;
            }
        }
    }
    
    // TERCERO: Si aún no se encontró, buscar por sector sin bloque
    if (!presidente && sectorSeleccionado) {
        const presidentes = Object.values(presidentesCache);
        for (const p of presidentes) {
            if (p.sector === sectorSeleccionado) {
                presidente = p;
                break;
            }
        }
    }
    
    datos.sort((a, b) => {
        const calleA = a.calle || '';
        const calleB = b.calle || '';
        if (calleA !== calleB) {
            return calleA.localeCompare(calleB);
        }
        const nombreA = a.nombre || '';
        const nombreB = b.nombre || '';
        return nombreA.localeCompare(nombreB);
    });
    
    const ventana = window.open('', '_blank', 'width=900,height=600');
    if (!ventana) {
        showNotification('⚠️ Permita ventanas emergentes para imprimir', 'warning');
        return;
    }
    
    let logoBase64 = '';
    try {
        const logoImg = document.querySelector('.nav-logo')?.src || '';
        if (logoImg) {
            logoBase64 = logoImg;
        }
    } catch(e) {}
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Tabla de Firmas - Junta Municipal San Luis</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Arial', sans-serif; 
                padding: 30px; 
                background: white;
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #B8860B;
                padding-bottom: 15px;
                margin-bottom: 20px;
                position: relative;
            }
            .header .logo {
                display: block;
                margin: 0 auto 10px;
                max-width: 80px;
                max-height: 80px;
            }
            .header h1 {
                color: #1a3c5e;
                font-size: 22px;
                letter-spacing: 2px;
            }
            .header .rnc {
                font-size: 12px;
                color: #6b7a8f;
            }
            .header .ubicacion {
                font-size: 12px;
                color: #6b7a8f;
            }
            .header h2 {
                color: #B8860B;
                font-size: 16px;
                font-weight: normal;
            }
            .header p {
                color: #6b7a8f;
                font-size: 13px;
                margin-top: 5px;
            }
            .header .fecha {
                font-weight: bold;
                color: #1a3c5e;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
            }
            th {
                background: #1a3c5e;
                color: white;
                padding: 10px 12px;
                text-align: left;
                font-size: 13px;
                border: 1px solid #1a3c5e;
            }
            td {
                padding: 10px 12px;
                border: 1px solid #ccc;
                font-size: 12px;
                vertical-align: middle;
            }
            .firma-cell {
                width: 200px;
                text-align: center;
                font-size: 11px;
                color: #999;
            }
            .firma-line {
                border-bottom: 1px solid #333;
                height: 30px;
                margin-bottom: 5px;
            }
            .numero-cell {
                text-align: center;
                font-weight: bold;
                width: 40px;
            }
            .firma-container {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 2px solid #B8860B;
            }
            .firma-box {
                text-align: center;
                width: 30%;
            }
            .firma-box .linea {
                border-bottom: 1px solid #000;
                height: 30px;
                margin: 0 auto 5px;
                width: 90%;
            }
            .firma-box .nombre {
                font-weight: bold;
                font-size: 13px;
                color: #1a3c5e;
            }
            .firma-box .cargo {
                font-size: 11px;
                color: #6b7a8f;
            }
            .firma-box .sello {
                font-size: 10px;
                color: #999;
                margin-top: 3px;
            }
            .firma-centro {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 2px solid #B8860B;
            }
            .firma-centro .linea {
                border-bottom: 1px solid #000;
                height: 30px;
                margin: 0 auto 5px;
                width: 60%;
            }
            .firma-centro .nombre {
                font-weight: bold;
                font-size: 13px;
                color: #1a3c5e;
            }
            .firma-centro .cedula {
                font-size: 10px;
                color: #999;
                margin-top: 2px;
            }
            .firma-centro .cargo {
                font-size: 11px;
                color: #6b7a8f;
            }
            .firma-centro .sello {
                font-size: 10px;
                color: #999;
                margin-top: 3px;
            }
            .btn-imprimir {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                background: #B8860B;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                font-weight: bold;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
            }
            .btn-imprimir:hover {
                background: #8B6900;
            }
            @media print {
                .btn-imprimir { display: none; }
                body { padding: 15px; }
                th { background: #1a3c5e !important; color: white !important; }
                .header { border-bottom: 3px solid #B8860B !important; }
                .firma-container { border-top: 2px solid #B8860B !important; }
                .firma-centro { border-top: 2px solid #B8860B !important; }
                .firma-box .linea { border-bottom: 1px solid #000 !important; }
                .firma-centro .linea { border-bottom: 1px solid #000 !important; }
                .firma-line { border-bottom: 1px solid #000 !important; }
            }
        </style>
    </head>
    <body>
        <button class="btn-imprimir" onclick="window.print()">
            <i class="fas fa-print"></i> Imprimir
        </button>
        
        <div class="header">
            <img src="${logoBase64 || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23ffffff%22/%3E%3Ccircle cx=%22100%22 cy=%22100%22 r=%2285%22 fill=%22%23B8860B%22/%3E%3Ccircle cx=%22100%22 cy=%22100%22 r=%2275%22 fill=%22%23D4AF37%22/%3E%3Ctext x=%22100%22 y=%22115%22 font-size=%2245%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-weight=%22bold%22 font-family=%22serif%22%3EJMSL%3C/text%3E%3C/svg%3E'}" alt="Logo" class="logo">
            <h1>JUNTA MUNICIPAL SAN LUIS</h1>
            <div class="rnc">RNC: 4-30-017809</div>
            <div class="ubicacion">MUNICIPIO: SANTO DOMINGO ESTE - PROVINCIA: SANTO DOMINGO</div>
            <h2>DEPARTAMENTO DE ASUNTOS COMUNITARIOS</h2>
            <p>REPORTE DE CENSO ELECTORAL - TABLA DE FIRMAS</p>
            <p class="fecha">Reporte: ${titulo} | Fecha: ${new Date().toLocaleDateString()} | Total: ${datos.length} personas</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th style="text-align:center;width:40px;">No.</th>
                    <th style="width:150px;">CÉDULA</th>
                    <th>NOMBRE COMPLETO</th>
                    <th style="width:200px;text-align:center;">FIRMA</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    datos.forEach((d, index) => {
        const nombre = d.nombre || '';
        const cedula = d.cedula || '';
        html += `
            <tr>
                <td class="numero-cell">${index + 1}</td>
                <td>${cedula}</td>
                <td>${nombre.toUpperCase()}</td>
                <td class="firma-cell">
                    <div class="firma-line"></div>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        
        <div class="firma-container">
            <div class="firma-box">
                <div class="linea"></div>
                <div class="nombre">FRANCISCO LORENZO</div>
                <div class="cargo">DIRECTOR</div>
                <div class="sello">[Sello]</div>
            </div>
            
            <div class="firma-box">
                <div class="linea"></div>
                <div class="nombre">DOMINGO CARSADO</div>
                <div class="cargo">ENCARGADO</div>
                <div class="sello">[Sello]</div>
            </div>
        </div>
    `;
    
    // ===== FIRMA DEL PRESIDENTE DE COMITÉ =====
    if (presidente) {
        html += `
        <div class="firma-centro">
            <div class="linea"></div>
            <div class="nombre">${presidente.nombre}</div>
            <div class="cedula">Cédula: ${presidente.cedula || 'N/A'}</div>
            <div class="cargo">PRESIDENTE DE COMITÉ</div>
            <div class="sello">[Sello]</div>
        </div>
        `;
    } else {
        // Si no hay presidente, mostrar espacio en blanco
        html += `
        <div class="firma-centro">
            <div class="linea"></div>
            <div class="nombre" style="color: #999; font-size: 11px;">(Sin presidente registrado)</div>
            <div class="cargo">PRESIDENTE DE COMITÉ</div>
        </div>
        `;
    }
    
    html += `

        <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #ccc;">
            Documento generado por el Sistema de Censo Electoral - Junta Municipal San Luis
        </div>
        
        <script>
            setTimeout(function() {
                window.print();
            }, 800);
        <\/script>
    </body>
    </html>
    `;
    
    ventana.document.write(html);
    ventana.document.close();
}
