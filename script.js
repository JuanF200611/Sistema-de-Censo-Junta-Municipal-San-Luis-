// ============================================================
// CONFIGURACIÓN FIREBASE
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDEFAULT_KEY_REPLACE_ME",
    authDomain: "departamentoasuntoscomunitario.firebaseapp.com",
    databaseURL: "https://departamentoasuntoscomunitario-default-rtdb.firebaseio.com",
    projectId: "departamentoasuntoscomunitario",
    storageBucket: "departamentoasuntoscomunitario.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================================
// VARIABLES GLOBALES
// ============================================================
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

// ============================================================
// REFERENCIAS EN TIEMPO REAL
// ============================================================
let bloquesListener = null;
let callesListener = null;
let encuestadoresListener = null;
let presidentesListener = null;
let censoListener = null;

// ============================================================
// FORMATOS AUTOMÁTICOS
// ============================================================
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

// ============================================================
// SISTEMA DE NOTIFICACIONES
// ============================================================
function showNotification(mensaje, tipo = 'success', duracion = 3000) {
    const notificacionAnterior = document.querySelector('.custom-notification');
    if (notificacionAnterior) notificacionAnterior.remove();
    
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
        <div style="flex:1;"><span style="color: #2c3e50;">${mensaje}</span></div>
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

// ============================================================
// LOADING OVERLAY
// ============================================================
function showLoading(mensaje = 'Guardando datos...') {
    const overlayAnterior = document.getElementById('loadingOverlay');
    if (overlayAnterior) overlayAnterior.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay active';
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex; justify-content: center; align-items: center;
        z-index: 9999; backdrop-filter: blur(4px);
        animation: fadeIn 0.3s ease;
    `;
    overlay.innerHTML = `
        <div style="background:white;padding:40px 50px;border-radius:12px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="width:60px;height:60px;margin:0 auto 20px;border:5px solid #f5f7fa;border-top:5px solid #B8860B;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
            <h3 style="color:#1a3c5e;margin-bottom:8px;">${mensaje}</h3>
            <p style="color:#6b7a8f;font-size:0.9rem;">Por favor espere...</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => { if (overlay.parentElement) overlay.remove(); }, 300);
    }
}

function ejecutarConLoading(callback, mensaje = 'Guardando datos...') {
    showLoading(mensaje);
    setTimeout(() => {
        callback();
        setTimeout(hideLoading, 600);
    }, 400);
}

// ============================================================
// LOGIN
// ============================================================
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        currentUser = { username: user, name: 'Administrador', role: 'admin' };
        document.getElementById('userNameDisplay').textContent = 'Administrador';
        document.getElementById('sectorDisplay').textContent = '';
        document.getElementById('reportSectorInfo').textContent = '';
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('loginError').textContent = '';
        mostrarMenuAdmin(true);
        mostrarFiltrosAdmin(true);
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
                    id: child.key,
                    sector: data.sector || null
                };
                document.getElementById('userNameDisplay').textContent = data.nombre;
                if (currentUser.sector) {
                    document.getElementById('sectorDisplay').textContent = '📍 Sector asignado: ' + currentUser.sector;
                    document.getElementById('reportSectorInfo').textContent = '📍 Reportes filtrados por sector: ' + currentUser.sector;
                }
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                document.getElementById('loginError').textContent = '';
                mostrarMenuAdmin(false);
                mostrarFiltrosAdmin(false);
                iniciarEscuchaTiempoReal();
                cargarDatosIniciales();
                document.getElementById('censoEncuestador').value = data.nombre;
                showNotification('✅ Bienvenido ' + data.nombre, 'success');
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

function mostrarFiltrosAdmin(esAdmin) {
    document.getElementById('filtrosDashboardContainer').style.display = esAdmin ? 'block' : 'none';
    document.getElementById('reportFiltrosAdmin').style.display = esAdmin ? 'block' : 'none';
}

function logout() {
    if (confirm('¿Está seguro que desea salir?')) {
        if (bloquesListener) { bloquesListener.off(); bloquesListener = null; }
        if (callesListener) { callesListener.off(); callesListener = null; }
        if (encuestadoresListener) { encuestadoresListener.off(); encuestadoresListener = null; }
        if (presidentesListener) { presidentesListener.off(); presidentesListener = null; }
        if (censoListener) { censoListener.off(); censoListener = null; }
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

// ============================================================
// NAVEGACIÓN
// ============================================================
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    const link = document.querySelector('.nav-menu a[onclick*="' + sectionId + '"]');
    if (link) link.classList.add('active');
    
    if (sectionId === 'reports') {
        cargarDatosReporte();
    }
    if (sectionId === 'adminPanel' && currentUser && currentUser.role === 'admin') {
        cargarTodasEncuestas();
        cargarPresidentesUI();
    }
    if (sectionId === 'misEncuestas') {
        cargarMisEncuestas();
    }
}

document.getElementById('navToggle').addEventListener('click', function() {
    document.getElementById('navMenu').classList.toggle('open');
});

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

// ============================================================
// ESCUCHA EN TIEMPO REAL
// ============================================================
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
        cargarFiltrosDashboard();
        cargarSelectoresReporte();
    });
    
    callesListener = db.ref('calles');
    callesListener.on('value', snapshot => {
        callesCache = {};
        snapshot.forEach(child => {
            const data = child.val();
            const key = child.key;
            const id = data.bloque + '_' + data.sector + '_' + data.nombre;
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
        cargarFiltrosDashboard();
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

// ============================================================
// CARGAR DATOS INICIALES
// ============================================================
function cargarDatosIniciales() {
    actualizarUI('todos');
    cargarSelectoresCenso();
    if (currentUser && currentUser.name) {
        document.getElementById('censoEncuestador').value = currentUser.name;
    }
    
    var inputCedula = document.getElementById('cedula');
    var inputTelefono = document.getElementById('telefono');
    
    inputCedula.addEventListener('input', function() {
        formatearCedula(this);
    });
    
    inputTelefono.addEventListener('input', function() {
        formatearTelefono(this);
    });
    
    inputCedula.addEventListener('paste', function() {
        setTimeout(function() { formatearCedula(inputCedula); }, 10);
    });
    
    inputTelefono.addEventListener('paste', function() {
        setTimeout(function() { formatearTelefono(inputTelefono); }, 10);
    });
    
    setTimeout(function() {
        cargarBloquesParaCalle();
        cargarBloquesParaPresidente();
        cargarFiltrosDashboard();
        cargarSelectoresReporte();
        cargarSectoresEnAsignacion();
    }, 500);
}

// ============================================================
// SECTORES EN ASIGNACIÓN DE ENCUESTADORES
// ============================================================
function cargarSectoresEnAsignacion() {
    var select = document.getElementById('encuestadorSectorAsignado');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar Sector</option>';
    Object.keys(bloquesCache).forEach(function(bloque) {
        var sectores = bloquesCache[bloque] || [];
        sectores.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = bloque + ' - ' + s.sector;
            select.appendChild(opt);
        });
    });
}

// ============================================================
// SELECTORES DINÁMICOS DEL CENSO
// ============================================================
function cargarSelectoresCenso() {
    var selectBloque = document.getElementById('censoBloque');
    var selectSector = document.getElementById('censoSector');
    var selectCalle = document.getElementById('censoCalle');
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        return ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b);
    });
    
    bloques.forEach(function(bloque) {
        var opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = 'Bloque ' + bloque;
        selectBloque.appendChild(opt);
    });
    
    var nuevoSelectBloque = selectBloque.cloneNode(true);
    selectBloque.parentNode.replaceChild(nuevoSelectBloque, selectBloque);
    
    var nuevoSelectSector = selectSector.cloneNode(true);
    selectSector.parentNode.replaceChild(nuevoSelectSector, selectSector);
    
    var nuevoSelectCalle = selectCalle.cloneNode(true);
    selectCalle.parentNode.replaceChild(nuevoSelectCalle, selectCalle);
    
    document.getElementById('censoBloque').addEventListener('change', function() {
        cargarSectoresPorBloque(this.value);
    });
    
    document.getElementById('censoSector').addEventListener('change', function() {
        var bloque = document.getElementById('censoBloque').value;
        cargarCallesPorBloqueYSector(bloque, this.value);
    });
    
    if (currentUser && currentUser.name) {
        document.getElementById('censoEncuestador').value = currentUser.name;
    }
    
    cargarSelectorEncuestadores();
    selectoresInicializados = true;
}

function cargarSectoresPorBloque(bloque) {
    var selectSector = document.getElementById('censoSector');
    var selectCalle = document.getElementById('censoCalle');
    
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    if (bloque && bloquesCache[bloque]) {
        var sectores = bloquesCache[bloque];
        // Si es encuestador, solo mostrar su sector
        if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
            sectores = sectores.filter(function(s) { return s.sector === currentUser.sector; });
        }
        sectores.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    }
}

function cargarCallesPorBloqueYSector(bloque, sector) {
    var selectCalle = document.getElementById('censoCalle');
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    if (bloque && sector) {
        var calles = Object.values(callesCache).filter(function(c) {
            return c.bloque === bloque && c.sector === sector;
        });
        calles.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
        
        calles.forEach(function(c) {
            var opt = document.createElement('option');
            opt.value = c.nombre;
            opt.textContent = c.nombre;
            selectCalle.appendChild(opt);
        });
    }
}

function actualizarSelectoresCenso() {
    if (!selectoresInicializados) {
        cargarSelectoresCenso();
        return;
    }
    
    var selectBloque = document.getElementById('censoBloque');
    var currentBloque = selectBloque.value;
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        return ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b);
    });
    
    // Si es encuestador, solo mostrar bloques que contengan su sector
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        bloques = bloques.filter(function(bloque) {
            var sectores = bloquesCache[bloque] || [];
            return sectores.some(function(s) { return s.sector === currentUser.sector; });
        });
    }
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    bloques.forEach(function(bloque) {
        var opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = 'Bloque ' + bloque;
        selectBloque.appendChild(opt);
    });
    
    if (currentBloque && bloques.indexOf(currentBloque) !== -1) {
        selectBloque.value = currentBloque;
        cargarSectoresPorBloque(currentBloque);
    } else {
        document.getElementById('censoSector').innerHTML = '<option value="">Seleccionar Sector</option>';
        document.getElementById('censoCalle').innerHTML = '<option value="">Seleccionar Calle</option>';
    }
}

// ============================================================
// BLOQUES Y SECTORES
// ============================================================
function cargarBloquesUI() {
    var container = document.getElementById('bloqueList');
    container.innerHTML = '';
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var sortedBloques = Object.keys(bloquesCache).sort(function(a, b) {
        return ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b);
    });
    
    if (sortedBloques.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay bloques registrados</p>';
        return;
    }
    
    sortedBloques.forEach(function(bloque) {
        var sectores = bloquesCache[bloque] || [];
        var sectoresNombres = sectores.map(function(s) { return s.sector; }).join(', ');
        
        var div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">🏛️ Bloque ${bloque}</span>
                <span class="detail">Sectores: ${sectoresNombres || 'Ninguno'}</span>
            </div>
            <div class="item-actions">
                <button class="btn-delete" onclick="eliminarBloque('${bloque}')" title="Eliminar bloque completo">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function eliminarBloque(bloque) {
    if (!confirm('⚠️ ¿Eliminar TODO el Bloque ' + bloque + ' y TODOS sus sectores?')) return;
    
    ejecutarConLoading(function() {
        var sectores = bloquesCache[bloque] || [];
        var updates = {};
        sectores.forEach(function(s) {
            updates[s.key] = null;
        });
        db.ref('bloques').update(updates)
            .then(function() { showNotification('✅ Bloque eliminado correctamente', 'success'); })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Eliminando bloque...');
}

function cargarSectoresUI() {
    var select = document.getElementById('calleSectorSelect');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar</option>';
        Object.keys(bloquesCache).forEach(function(bloque) {
            var sectores = bloquesCache[bloque] || [];
            sectores.forEach(function(s) {
                var option = document.createElement('option');
                option.value = s.sector;
                option.textContent = s.sector + ' (Bloque ' + bloque + ')';
                option.dataset.bloque = bloque;
                option.dataset.key = s.key;
                select.appendChild(option);
            });
        });
    }
    
    cargarSectoresEnAsignacion();
}

document.getElementById('bloqueForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var bloque = document.getElementById('bloqueSelect').value;
    var sector = document.getElementById('sectorNombre').value.trim();
    
    if (!bloque || !sector) {
        showNotification('⚠️ Por favor seleccione un bloque y escriba un sector', 'warning');
        return;
    }
    
    var sectores = bloquesCache[bloque] || [];
    var existe = sectores.some(function(s) { return s.sector === sector; });
    if (existe) {
        showNotification('⚠️ Este sector ya existe en el bloque seleccionado', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        var key = bloque + '_' + sector.replace(/\s/g, '_');
        var data = { bloque: bloque, sector: sector };
        
        db.ref('bloques/' + key).set(data)
            .then(function() {
                document.getElementById('sectorNombre').value = '';
                document.getElementById('bloqueSelect').value = '';
                showNotification('✅ Bloque y sector guardados correctamente', 'success');
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Guardando bloque y sector...');
});

// ============================================================
// CALLES
// ============================================================
function cargarCallesUI() {
    var container = document.getElementById('calleList');
    container.innerHTML = '';
    
    var calles = Object.values(callesCache);
    if (calles.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay calles registradas</p>';
        return;
    }
    
    calles.sort(function(a, b) { return a.bloque.localeCompare(b.bloque) || a.sector.localeCompare(b.sector); });
    
    calles.forEach(function(calle) {
        var div = document.createElement('div');
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
    var bloque = document.getElementById('calleBloqueSelect').value;
    var sector = document.getElementById('calleSectorSelect').value;
    var nombre = document.getElementById('calleNombre').value.trim();
    
    if (!bloque || !sector || !nombre) {
        showNotification('⚠️ Por favor complete todos los campos', 'warning');
        return;
    }
    
    var existe = Object.values(callesCache).some(function(c) {
        return c.bloque === bloque && c.sector === sector && c.nombre === nombre;
    });
    if (existe) {
        showNotification('⚠️ Esta calle ya existe en este bloque y sector', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        var key = bloque + '_' + sector + '_' + nombre.replace(/\s/g, '_');
        var data = { bloque: bloque, sector: sector, nombre: nombre };
        
        db.ref('calles/' + key).set(data)
            .then(function() {
                document.getElementById('calleNombre').value = '';
                showNotification('✅ Calle guardada correctamente', 'success');
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Guardando calle...');
});

function eliminarCalle(key) {
    if (!confirm('⚠️ ¿Eliminar esta calle?')) return;
    
    ejecutarConLoading(function() {
        db.ref('calles/' + key).remove()
            .then(function() { showNotification('✅ Calle eliminada', 'success'); })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Eliminando calle...');
}

// ============================================================
// SELECTORES PARA AGREGAR CALLE
// ============================================================
function cargarBloquesParaCalle() {
    var selectBloque = document.getElementById('calleBloqueSelect');
    if (!selectBloque) return;
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        return ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b);
    });
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    bloques.forEach(function(bloque) {
        var opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = 'Bloque ' + bloque;
        selectBloque.appendChild(opt);
    });
    
    selectBloque.onchange = function() {
        cargarSectoresParaCalle(this.value);
    };
}

function cargarSectoresParaCalle(bloque) {
    var selectSector = document.getElementById('calleSectorSelect');
    if (!selectSector) return;
    
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    
    if (bloque && bloquesCache[bloque]) {
        bloquesCache[bloque].forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    }
}

// ============================================================
// ENCUESTADORES - CON BOTÓN DE EDICIÓN
// ============================================================
function cargarEncuestadoresUI() {
    var container = document.getElementById('encuestadorList');
    container.innerHTML = '';
    
    var keys = Object.keys(encuestadoresCache);
    if (keys.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay encuestadores registrados</p>';
        return;
    }
    
    keys.forEach(function(key) {
        var data = encuestadoresCache[key];
        var div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">👤 ${data.nombre}</span>
                <span class="detail">Usuario: ${data.usuario} | Sector: ${data.sector || 'Sin asignar'}</span>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editarEncuestador('${key}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-delete" onclick="eliminarEncuestador('${key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    cargarSelectorEncuestadores();
    cargarSectoresEnAsignacion();
}

document.getElementById('usuarioForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var nombre = document.getElementById('encuestadorNombre').value.trim();
    var usuario = document.getElementById('encuestadorUser').value.trim();
    var contraseña = document.getElementById('encuestadorPass').value.trim();
    var sector = document.getElementById('encuestadorSectorAsignado').value;
    
    if (!nombre || !usuario || !contraseña || !sector) {
        showNotification('⚠️ Por favor complete todos los campos', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        var key = 'encuestador_' + Date.now();
        var data = { 
            nombre: nombre, 
            usuario: usuario, 
            contraseña: contraseña,
            sector: sector,
            registradoPor: (currentUser && currentUser.name) || 'Admin',
            fechaRegistro: new Date().toISOString()
        };
        
        db.ref('encuestadores/' + key).set(data)
            .then(function() {
                document.getElementById('encuestadorNombre').value = '';
                document.getElementById('encuestadorUser').value = '';
                document.getElementById('encuestadorPass').value = '';
                document.getElementById('encuestadorSectorAsignado').value = '';
                showNotification('✅ Encuestador registrado correctamente', 'success');
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Registrando encuestador...');
});

function eliminarEncuestador(key) {
    if (!confirm('⚠️ ¿Eliminar este encuestador?')) return;
    
    ejecutarConLoading(function() {
        db.ref('encuestadores/' + key).remove()
            .then(function() {
                showNotification('✅ Encuestador eliminado', 'success');
                cargarEncuestadoresUI();
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Eliminando encuestador...');
}

function editarEncuestador(key) {
    var data = encuestadoresCache[key];
    if (!data) {
        showNotification('❌ No se encontraron datos del encuestador', 'error');
        return;
    }
    
    var opciones = 'Seleccione el sector para asignar al encuestador:\n\n';
    var sectores = [];
    Object.keys(bloquesCache).forEach(function(bloque) {
        var sectoresBloque = bloquesCache[bloque] || [];
        sectoresBloque.forEach(function(s) {
            var texto = bloque + ' - ' + s.sector;
            sectores.push(texto);
            opciones += sectores.length + '. ' + texto + '\n';
        });
    });
    
    if (sectores.length === 0) {
        showNotification('⚠️ No hay sectores disponibles. Cree un bloque y sector primero.', 'warning');
        return;
    }
    
    opciones += '\nIngrese el número del sector (1-' + sectores.length + '):';
    var seleccion = prompt(opciones, '');
    
    if (seleccion === null) return;
    var idx = parseInt(seleccion) - 1;
    if (isNaN(idx) || idx < 0 || idx >= sectores.length) {
        showNotification('❌ Selección inválida', 'error');
        return;
    }
    
    var sectorSeleccionado = sectores[idx];
    var sectorNombre = sectorSeleccionado.split(' - ')[1];
    
    if (!confirm('¿Asignar el sector "' + sectorNombre + '" al encuestador "' + data.nombre + '"?')) return;
    
    ejecutarConLoading(function() {
        db.ref('encuestadores/' + key).update({ sector: sectorNombre })
            .then(function() {
                showNotification('✅ Sector "' + sectorNombre + '" asignado a ' + data.nombre, 'success');
                cargarEncuestadoresUI();
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Asignando sector...');
}

function cargarSelectorEncuestadores() {
    var select = document.getElementById('censoEncuestador');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar Encuestador</option>';
    Object.values(encuestadoresCache).forEach(function(data) {
        var opt = document.createElement('option');
        opt.value = data.nombre;
        opt.textContent = data.nombre;
        select.appendChild(opt);
    });
    if (currentUser && currentUser.name) {
        select.value = currentUser.name;
    }
}

// ============================================================
// PRESIDENTES DE COMITÉ
// ============================================================
function cargarBloquesParaPresidente() {
    var selectBloque = document.getElementById('presidenteBloque');
    if (!selectBloque) return;
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        return ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b);
    });
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    bloques.forEach(function(bloque) {
        var opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = 'Bloque ' + bloque;
        selectBloque.appendChild(opt);
    });
    
    selectBloque.onchange = function() {
        cargarSectoresParaPresidente(this.value);
    };
}

function cargarSectoresParaPresidente(bloque) {
    var selectSector = document.getElementById('presidenteSector');
    if (!selectSector) return;
    
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    
    if (bloque && bloquesCache[bloque]) {
        bloquesCache[bloque].forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    }
}

document.getElementById('presidenteForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var bloque = document.getElementById('presidenteBloque').value;
    var sector = document.getElementById('presidenteSector').value;
    var nombre = document.getElementById('presidenteNombre').value.trim().toUpperCase();
    var cedula = document.getElementById('presidenteCedula').value.trim();
    
    if (!bloque || !sector || !nombre) {
        showNotification('⚠️ Por favor complete todos los campos', 'warning');
        return;
    }
    
    var existe = Object.values(presidentesCache).some(function(p) {
        return p.bloque === bloque && p.sector === sector;
    });
    if (existe) {
        showNotification('⚠️ Ya existe un presidente para este bloque y sector', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        var key = 'presidente_' + Date.now();
        var data = { 
            bloque: bloque, 
            sector: sector, 
            nombre: nombre,
            cedula: cedula || '',
            registradoPor: (currentUser && currentUser.name) || 'Admin',
            fechaRegistro: new Date().toISOString()
        };
        
        db.ref('presidentes/' + key).set(data)
            .then(function() {
                document.getElementById('presidenteNombre').value = '';
                document.getElementById('presidenteCedula').value = '';
                document.getElementById('presidenteBloque').value = '';
                document.getElementById('presidenteSector').innerHTML = '<option value="">Seleccionar</option>';
                showNotification('✅ Presidente de comité registrado correctamente', 'success');
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Registrando presidente...');
});

function cargarPresidentesUI() {
    var container = document.getElementById('presidenteList');
    container.innerHTML = '';
    
    var keys = Object.keys(presidentesCache);
    if (keys.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay presidentes de comité registrados</p>';
        return;
    }
    
    keys.forEach(function(key) {
        var data = presidentesCache[key];
        var div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="name">👔 ${data.nombre}</span>
                <span class="detail">Bloque ${data.bloque} - ${data.sector} | Cédula: ${data.cedula || 'N/A'}</span>
            </div>
            <div class="item-actions">
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
    
    ejecutarConLoading(function() {
        db.ref('presidentes/' + key).remove()
            .then(function() { showNotification('✅ Presidente eliminado correctamente', 'success'); })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Eliminando presidente...');
}

function getPresidentePorSector(bloque, sector) {
    var presidentes = Object.values(presidentesCache);
    for (var i = 0; i < presidentes.length; i++) {
        if (presidentes[i].bloque === bloque && presidentes[i].sector === sector) {
            return presidentes[i];
        }
    }
    return null;
}

// ============================================================
// CENSO (Encuestas)
// ============================================================
document.getElementById('censusFormData').addEventListener('submit', function(e) {
    e.preventDefault();
    
    var cedula = document.getElementById('cedula').value.trim();
    var encuestador = (currentUser && currentUser.name) || document.getElementById('censoEncuestador').value || 'Desconocido';
    
    var existe = Object.values(censoCache).some(function(d) { return d.cedula === cedula && !window.editKey; });
    if (existe) {
        showNotification('⚠️ Esta cédula ya está registrada. Cada persona debe tener un registro único.', 'warning');
        return;
    }
    
    var data = {
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
        registradoPor: (currentUser && currentUser.name) || 'Desconocido'
    };
    
    if (!data.cedula || !data.nombre || !data.sexo || !data.direccion || 
        !data.bloque || !data.sector || !data.calle) {
        showNotification('⚠️ Por favor complete todos los campos obligatorios (*)', 'warning');
        return;
    }
    
    // Validar que el encuestador solo encueste en su sector asignado
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        if (data.sector !== currentUser.sector) {
            showNotification('⚠️ Solo puede encuestar en el sector asignado: ' + currentUser.sector, 'warning');
            return;
        }
    }
    
    ejecutarConLoading(function() {
        var key = 'censo_' + Date.now();
        db.ref('censo/' + key).set(data)
            .then(function() {
                document.getElementById('censusFormData').reset();
                document.getElementById('censoBloque').value = '';
                document.getElementById('censoSector').innerHTML = '<option value="">Seleccionar Sector</option>';
                document.getElementById('censoCalle').innerHTML = '<option value="">Seleccionar Calle</option>';
                document.getElementById('censoEncuestador').value = encuestador;
                showNotification('✅ Encuesta guardada correctamente', 'success');
                window.editKey = null;
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Guardando encuesta...');
});

function cargarUltimasEncuestas() {
    var container = document.getElementById('ultimasEncuestas');
    container.innerHTML = '';
    
    var items = Object.values(censoCache);
    
    // Si es encuestador, solo mostrar sus encuestas
    if (currentUser && currentUser.role !== 'admin' && currentUser.name) {
        items = items.filter(function(d) { return d.encuestador === currentUser.name; });
    }
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay encuestas registradas</p>';
        return;
    }
    
    items.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    var ultimas = items.slice(0, 10);
    
    ultimas.forEach(function(item) {
        var div = document.createElement('div');
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

// ============================================================
// MIS ENCUESTAS
// ============================================================
function cargarMisEncuestas() {
    if (!currentUser || !currentUser.name) return;
    
    var container = document.getElementById('listaMisEncuestas');
    container.innerHTML = '';
    
    var items = Object.values(censoCache).filter(function(d) { return d.encuestador === currentUser.name; });
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No has realizado encuestas</p>';
        return;
    }
    
    items.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    
    items.forEach(function(item) {
        var key = Object.keys(censoCache).find(function(k) { return censoCache[k] === item; });
        var div = document.createElement('div');
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
    var cedula = document.getElementById('misBuscarCedula').value.trim().toLowerCase();
    var nombre = document.getElementById('misBuscarNombre').value.trim().toLowerCase();
    
    if (!cedula && !nombre) {
        cargarMisEncuestas();
        return;
    }
    
    var container = document.getElementById('listaMisEncuestas');
    container.innerHTML = '';
    
    var items = Object.values(censoCache).filter(function(d) {
        if (d.encuestador !== currentUser.name) return false;
        var matchCedula = !cedula || (d.cedula && d.cedula.toLowerCase().indexOf(cedula) !== -1);
        var matchNombre = !nombre || (d.nombre && d.nombre.toLowerCase().indexOf(nombre) !== -1);
        return matchCedula && matchNombre;
    });
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No se encontraron encuestas</p>';
        return;
    }
    
    items.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    
    items.forEach(function(item) {
        var key = Object.keys(censoCache).find(function(k) { return censoCache[k] === item; });
        var div = document.createElement('div');
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
    
    ejecutarConLoading(function() {
        db.ref('censo/' + key).remove()
            .then(function() {
                showNotification('✅ Encuesta eliminada correctamente', 'success');
                cargarMisEncuestas();
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Eliminando encuesta...');
}

// ============================================================
// ADMIN: GESTIÓN DE ENCUESTAS
// ============================================================
function cargarTodasEncuestas() {
    document.getElementById('buscarCedula').value = '';
    document.getElementById('buscarNombre').value = '';
    cargarEncuestasFiltradas();
}

function buscarEncuestas() {
    cargarEncuestasFiltradas();
}

function cargarEncuestasFiltradas() {
    var cedula = document.getElementById('buscarCedula').value.trim().toLowerCase();
    var nombre = document.getElementById('buscarNombre').value.trim().toLowerCase();
    
    var container = document.getElementById('listaEncuestasAdmin');
    container.innerHTML = '';
    
    var items = Object.values(censoCache);
    if (cedula || nombre) {
        items = items.filter(function(d) {
            var matchCedula = !cedula || (d.cedula && d.cedula.toLowerCase().indexOf(cedula) !== -1);
            var matchNombre = !nombre || (d.nombre && d.nombre.toLowerCase().indexOf(nombre) !== -1);
            return matchCedula && matchNombre;
        });
    }
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No se encontraron encuestas</p>';
        return;
    }
    
    items.sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    
    items.forEach(function(item) {
        var key = Object.keys(censoCache).find(function(k) { return censoCache[k] === item; });
        var div = document.createElement('div');
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
    
    ejecutarConLoading(function() {
        db.ref('censo/' + key).remove()
            .then(function() {
                showNotification('✅ Encuesta eliminada correctamente', 'success');
                cargarTodasEncuestas();
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Eliminando encuesta...');
}

function editarEncuesta(key) {
    var data = censoCache[key];
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
    document.getElementById('censoEncuestador').value = data.encuestador || (currentUser && currentUser.name) || '';
    
    setTimeout(function() {
        if (data.bloque) {
            cargarSectoresPorBloque(data.bloque);
            setTimeout(function() {
                document.getElementById('censoSector').value = data.sector || '';
                if (data.sector && data.bloque) {
                    cargarCallesPorBloqueYSector(data.bloque, data.sector);
                    setTimeout(function() {
                        document.getElementById('censoCalle').value = data.calle || '';
                    }, 200);
                }
            }, 200);
        }
    }, 300);
    
    window.editKey = key;
    
    var submitBtn = document.querySelector('#censusFormData button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Encuesta';
    submitBtn.onclick = function(e) {
        e.preventDefault();
        actualizarEncuesta(key);
    };
    
    showSection('censusForm');
    showNotification('📝 Editando encuesta - Modifique los datos y presione "Actualizar Encuesta"', 'info', 4000);
}

function actualizarEncuesta(key) {
    var cedula = document.getElementById('cedula').value.trim();
    
    var duplicado = Object.values(censoCache).some(function(d) {
        return d.cedula === cedula && Object.keys(censoCache).find(function(k) { return censoCache[k] === d; }) !== key;
    });
    if (duplicado) {
        showNotification('⚠️ Esta cédula ya está registrada. Cada persona debe tener un registro único.', 'warning');
        return;
    }
    
    var data = {
        cedula: cedula,
        nombre: document.getElementById('nombreCompleto').value.trim().toUpperCase(),
        sexo: document.getElementById('sexo').value,
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim().toUpperCase(),
        bloque: document.getElementById('censoBloque').value,
        sector: document.getElementById('censoSector').value,
        calle: document.getElementById('censoCalle').value.toUpperCase(),
        encuestador: document.getElementById('censoEncuestador').value || (currentUser && currentUser.name) || 'Desconocido',
        fecha: new Date().toISOString(),
        fechaRegistro: new Date().toLocaleString(),
        registradoPor: (currentUser && currentUser.name) || 'Desconocido',
        editado: true,
        editadoPor: (currentUser && currentUser.name) || 'Admin',
        fechaEdicion: new Date().toLocaleString()
    };
    
    if (!data.cedula || !data.nombre || !data.sexo || !data.direccion || 
        !data.bloque || !data.sector || !data.calle) {
        showNotification('⚠️ Por favor complete todos los campos obligatorios (*)', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        db.ref('censo/' + key).update(data)
            .then(function() {
                var submitBtn = document.querySelector('#censusFormData button[type="submit"]');
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Guardar Encuesta';
                submitBtn.onclick = function(e) {
                    e.preventDefault();
                    document.getElementById('censusFormData').dispatchEvent(new Event('submit'));
                };
                
                document.getElementById('censusFormData').reset();
                document.getElementById('censoBloque').value = '';
                document.getElementById('censoSector').innerHTML = '<option value="">Seleccionar Sector</option>';
                document.getElementById('censoCalle').innerHTML = '<option value="">Seleccionar Calle</option>';
                document.getElementById('censoEncuestador').value = (currentUser && currentUser.name) || '';
                showNotification('✅ Encuesta actualizada correctamente', 'success');
                window.editKey = null;
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Actualizando encuesta...');
}

// ============================================================
// ESTADÍSTICAS - FILTRADAS POR SECTOR PARA ENCUESTADORES
// ============================================================
function actualizarEstadisticas() {
    var totalCensados = Object.keys(censoCache).length;
    var totalMisCensados = 0;
    
    // Si es encuestador, filtrar por su sector
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        var items = Object.values(censoCache).filter(function(d) { return d.sector === currentUser.sector; });
        totalCensados = items.length;
        // Mis encuestas
        var misItems = Object.values(censoCache).filter(function(d) { return d.encuestador === currentUser.name; });
        totalMisCensados = misItems.length;
    } else if (currentUser && currentUser.role !== 'admin' && currentUser.name) {
        // Encuestador sin sector asignado
        var misItems2 = Object.values(censoCache).filter(function(d) { return d.encuestador === currentUser.name; });
        totalMisCensados = misItems2.length;
    }
    
    document.getElementById('totalCensados').textContent = totalCensados;
    document.getElementById('totalMisCensados').textContent = totalMisCensados;
    document.getElementById('totalBloques').textContent = Object.keys(bloquesCache).length;
    document.getElementById('totalCalles').textContent = Object.keys(callesCache).length;
    document.getElementById('totalEncuestadores').textContent = Object.keys(encuestadoresCache).length;
}

// ============================================================
// FILTROS DEL DASHBOARD - SOLO PARA ADMIN
// ============================================================
function cargarFiltrosDashboard() {
    var selectBloque = document.getElementById('filtroBloque');
    var selectSector = document.getElementById('filtroSector');
    var selectEncuestador = document.getElementById('filtroEncuestador');
    
    if (!selectBloque) return;
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        return ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b);
    });
    
    selectBloque.innerHTML = '<option value="">Todos</option>';
    bloques.forEach(function(bloque) {
        var opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = 'Bloque ' + bloque;
        selectBloque.appendChild(opt);
    });
    
    selectSector.innerHTML = '<option value="">Todos</option>';
    Object.keys(bloquesCache).forEach(function(bloque) {
        var sectores = bloquesCache[bloque] || [];
        sectores.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    });
    
    selectEncuestador.innerHTML = '<option value="">Todos</option>';
    Object.values(encuestadoresCache).forEach(function(data) {
        var opt = document.createElement('option');
        opt.value = data.nombre;
        opt.textContent = data.nombre;
        selectEncuestador.appendChild(opt);
    });
}

function aplicarFiltrosDashboard() {
    var bloque = document.getElementById('filtroBloque').value;
    var sector = document.getElementById('filtroSector').value;
    var encuestador = document.getElementById('filtroEncuestador').value;
    
    var items = Object.values(censoCache);
    
    if (bloque) {
        items = items.filter(function(d) { return d.bloque === bloque; });
    }
    if (sector) {
        items = items.filter(function(d) { return d.sector === sector; });
    }
    if (encuestador) {
        items = items.filter(function(d) { return d.encuestador === encuestador; });
    }
    
    document.getElementById('totalCensados').textContent = items.length;
}

// ============================================================
// REPORTES
// ============================================================
document.getElementById('reportType').addEventListener('change', function() {
    var tipo = this.value;
    document.getElementById('reportBloqueGroup').style.display = tipo === 'bloque' ? 'block' : 'none';
    document.getElementById('reportSectorGroup').style.display = tipo === 'sector' ? 'block' : 'none';
    
    if (tipo === 'bloque' || tipo === 'sector') {
        cargarSelectoresReporte();
    }
});

function cargarSelectoresReporte() {
    var selectBloque = document.getElementById('reportBloque');
    var selectSector = document.getElementById('reportSector');
    
    if (!selectBloque) return;
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        return ordenRomanos.indexOf(a) - ordenRomanos.indexOf(b);
    });
    
    selectBloque.innerHTML = '<option value="">Seleccionar</option>';
    bloques.forEach(function(b) {
        var opt = document.createElement('option');
        opt.value = b;
        opt.textContent = '🏛️ Bloque ' + b;
        selectBloque.appendChild(opt);
    });
    
    selectSector.innerHTML = '<option value="">Seleccionar</option>';
    Object.keys(bloquesCache).forEach(function(bloque) {
        var sectores = bloquesCache[bloque] || [];
        sectores.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.sector;
            opt.textContent = s.sector;
            selectSector.appendChild(opt);
        });
    });
}

document.getElementById('reportBloque').addEventListener('change', function() {
    var bloque = this.value;
    var sectorSelect = document.getElementById('reportSector');
    sectorSelect.innerHTML = '<option value="">Seleccionar</option>';
    
    if (bloque && bloquesCache[bloque]) {
        bloquesCache[bloque].forEach(function(s) {
            var opt = document.createElement('option');
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
    var checkboxes = document.querySelectorAll('.col-check:checked');
    var columnas = [];
    checkboxes.forEach(function(cb) { columnas.push(cb.value); });
    return columnas;
}

function generarReporte(tipo) {
    var columnas = getColumnasSeleccionadas();
    if (columnas.length === 0) {
        showNotification('⚠️ Seleccione al menos una columna para el reporte', 'warning');
        return;
    }
    
    var datos = Object.values(censoCache);
    var titulo = 'Todos los Sectores';
    
    // Si es encuestador, filtrar por su sector
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        datos = datos.filter(function(d) { return d.sector === currentUser.sector; });
        titulo = 'Sector: ' + currentUser.sector;
    } else {
        // Solo admin puede usar filtros
        var reportType = document.getElementById('reportType').value;
        if (reportType === 'bloque') {
            var bloque = document.getElementById('reportBloque').value;
            if (!bloque) { showNotification('⚠️ Seleccione un bloque', 'warning'); return; }
            datos = datos.filter(function(d) { return d.bloque === bloque; });
            titulo = 'Bloque ' + bloque;
        } else if (reportType === 'sector') {
            var sector = document.getElementById('reportSector').value;
            if (!sector) { showNotification('⚠️ Seleccione un sector', 'warning'); return; }
            datos = datos.filter(function(d) { return d.sector === sector; });
            titulo = 'Sector: ' + sector;
        }
        
        // Filtro por fecha (solo admin)
        var fechaDesde = document.getElementById('reportFechaDesde').value;
        var fechaHasta = document.getElementById('reportFechaHasta').value;
        
        if (fechaDesde) {
            var desde = new Date(fechaDesde).getTime();
            datos = datos.filter(function(d) { return new Date(d.fecha).getTime() >= desde; });
        }
        if (fechaHasta) {
            var hasta = new Date(fechaHasta).getTime() + 86400000;
            datos = datos.filter(function(d) { return new Date(d.fecha).getTime() <= hasta; });
        }
        
        // Ordenamiento (solo admin)
        var orderBy = document.getElementById('reportOrderBy').value;
        var orderDir = document.getElementById('reportOrderDir').value;
        
        datos.sort(function(a, b) {
            var valA = a[orderBy] || '';
            var valB = b[orderBy] || '';
            if (orderBy === 'fecha') {
                valA = new Date(valA).getTime() || 0;
                valB = new Date(valB).getTime() || 0;
            }
            if (valA < valB) return orderDir === 'asc' ? -1 : 1;
            if (valA > valB) return orderDir === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    if (datos.length === 0) {
        showNotification('⚠️ No hay datos para generar el reporte', 'warning');
        return;
    }
    
    mostrarVistaPrevia(datos, titulo, columnas);
    
    if (tipo === 'excel') {
        exportarExcel(datos, titulo, columnas);
    } else {
        exportarPDF(datos, titulo, columnas);
    }
}

// ============================================================
// VISTA PREVIA
// ============================================================
function mostrarVistaPrevia(datos, titulo, columnas) {
    var container = document.getElementById('reportPreview');
    var headersMap = {
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
    
    var html = `
        <div class="preview-container">
            <div class="preview-header">
                <h3>JUNTA MUNICIPAL SAN LUIS</h3>
                <div class="rnc">RNC: 4-30-017809</div>
                <div class="ubicacion">MUNICIPIO: SANTO DOMINGO ESTE - PROVINCIA: SANTO DOMINGO</div>
                <div class="depto">DEPARTAMENTO DE ASUNTOS COMUNITARIOS</div>
                <div class="preview-title">REPORTE DE CENSO ELECTORAL</div>
            </div>
            <div class="preview-info">
                <span><strong>Reporte:</strong> ${titulo}</span>
                <span><strong>Total:</strong> ${datos.length} registros</span>
                <span><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</span>
                ${document.getElementById('reportFechaDesde').value ? '<span><strong>Desde:</strong> ' + document.getElementById('reportFechaDesde').value + '</span>' : ''}
                ${document.getElementById('reportFechaHasta').value ? '<span><strong>Hasta:</strong> ' + document.getElementById('reportFechaHasta').value + '</span>' : ''}
                <span><strong>Orden:</strong> ${document.getElementById('reportOrderBy').value} (${document.getElementById('reportOrderDir').value})</span>
            </div>
            <div class="preview-table-wrapper">
                <table class="preview-table">
                    <thead>
                        <tr>
                            <th class="centered">No.</th>
    `;
    
    columnas.forEach(function(col) {
        html += '<th>' + (headersMap[col] || col) + '</th>';
    });
    html += '</tr></thead><tbody>';
    
    var limit = Math.min(datos.length, 50);
    for (var i = 0; i < limit; i++) {
        var d = datos[i];
        html += '<tr>';
        html += '<td class="numero">' + (i + 1) + '</td>';
        columnas.forEach(function(col) {
            var valor = d[col] || '';
            if (col === 'fecha') {
                valor = d.fechaRegistro || new Date(d.fecha).toLocaleString() || '';
            } else if (col !== 'cedula' && col !== 'telefono') {
                valor = valor.toUpperCase();
            }
            html += '<td>' + valor + '</td>';
        });
        html += '</tr>';
    }
    
    if (datos.length > 50) {
        html += '<tr><td colspan="' + (columnas.length + 1) + '" style="text-align:center;color:var(--gray-dark);padding:10px;">';
        html += '... y ' + (datos.length - 50) + ' registros más';
        html += '</td></tr>';
    }
    
    html += `
                </tbody></table>
            </div>
            <div class="preview-footer">
                <div class="firma-info">
                    <strong>Francisco Lorenzo</strong>
                    <div class="firma-line"></div>
                    <span class="firma-cargo">DIRECTOR</span>
                </div>
                <div class="firma-info">
                    <strong>Domingo Carsado</strong>
                    <div class="firma-line"></div>
                    <span class="firma-cargo">ENCARGADO</span>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// ============================================================
// EXPORTAR EXCEL
// ============================================================
function exportarExcel(datos, titulo, columnas) {
    var headersMap = {
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
    
    var headers = ['No.'];
    columnas.forEach(function(col) {
        headers.push(headersMap[col] || col);
    });
    var rows = [headers];
    
    datos.forEach(function(d, index) {
        var row = [index + 1];
        columnas.forEach(function(col) {
            var valor = d[col] || '';
            if (col === 'fecha') {
                valor = d.fechaRegistro || new Date(d.fecha).toLocaleString() || '';
            } else if (col !== 'cedula' && col !== 'telefono') {
                valor = valor.toUpperCase();
            }
            row.push(valor);
        });
        rows.push(row);
    });
    
    var csvContent = rows.map(function(row) { return row.join(','); }).join('\n');
    var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Censo_JMSL_' + titulo.replace(/\s/g, '_') + '_' + new Date().toISOString().slice(0,10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showNotification('✅ Reporte Excel generado correctamente', 'success');
}

// ============================================================
// EXPORTAR PDF - CORREGIDO
// ============================================================
function exportarPDF(datos, titulo, columnas) {
    try {
        if (typeof window.jspdf === 'undefined') {
            showNotification('❌ La librería jspdf no está cargada correctamente', 'error');
            return;
        }
        
        var jsPDF = window.jspdf.jsPDF;
        if (!jsPDF) {
            showNotification('❌ Error al cargar la librería PDF', 'error');
            return;
        }
        
        var doc = new jsPDF('landscape', 'mm', 'letter');
        var pageWidth = doc.internal.pageSize.getWidth();
        var pageHeight = doc.internal.pageSize.getHeight();
        var margin = 10;
        var pageCount = 1;
        
        var headersMap = {
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
        
        var headers = ['No.'];
        columnas.forEach(function(col) {
            headers.push(headersMap[col] || col.toUpperCase());
        });
        
        var colWidths = {
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
        
        var colWidthsArray = [];
        headers.forEach(function(h, i) {
            if (i === 0) {
                colWidthsArray.push(colWidths.no);
            } else {
                var colKey = columnas[i - 1];
                colWidthsArray.push(colWidths[colKey] || 25);
            }
        });
        
        var totalTableWidth = colWidthsArray.reduce(function(a, b) { return a + b; }, 0);
        var availableWidth = pageWidth - margin * 2;
        var finalColWidths = colWidthsArray.slice();
        if (totalTableWidth > availableWidth) {
            var factor = availableWidth / totalTableWidth;
            finalColWidths = colWidthsArray.map(function(w) { return Math.floor(w * factor); });
        }
        
        function dibujarEncabezado(doc) {
            try {
                var logoImg = document.querySelector('.nav-logo') && document.querySelector('.nav-logo').src || '';
                if (logoImg) {
                    var logoWidth = 18;
                    var logoHeight = 18;
                    var xLogo = (pageWidth - logoWidth) / 2;
                    doc.addImage(logoImg, 'PNG', xLogo, 2, logoWidth, logoHeight);
                }
            } catch(e) {}
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('JUNTA MUNICIPAL SAN LUIS', pageWidth/2, 24, { align: 'center' });
            doc.setFontSize(7);
            doc.text('RNC: 4-30-017809', pageWidth/2, 29, { align: 'center' });
            doc.text('MUNICIPIO: SANTO DOMINGO ESTE - PROVINCIA: SANTO DOMINGO', pageWidth/2, 33, { align: 'center' });
            doc.text('DEPARTAMENTO DE ASUNTOS COMUNITARIOS', pageWidth/2, 37, { align: 'center' });
            doc.setFontSize(9);
            doc.text('REPORTE DE CENSO ELECTORAL', pageWidth/2, 43, { align: 'center' });
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.text('REPORTE: ' + titulo.toUpperCase(), pageWidth/2, 49, { align: 'center' });
            doc.text('FECHA: ' + new Date().toLocaleDateString(), pageWidth/2, 53, { align: 'center' });
            doc.text('TOTAL DE REGISTROS: ' + datos.length, pageWidth/2, 57, { align: 'center' });
            
            var fechaDesde = document.getElementById('reportFechaDesde') && document.getElementById('reportFechaDesde').value || '';
            var fechaHasta = document.getElementById('reportFechaHasta') && document.getElementById('reportFechaHasta').value || '';
            var filtros = '';
            if (fechaDesde) filtros += 'Desde: ' + fechaDesde + ' ';
            if (fechaHasta) filtros += 'Hasta: ' + fechaHasta;
            if (filtros) {
                doc.text('FILTRO: ' + filtros, pageWidth/2, 61, { align: 'center' });
                return 66;
            }
            return 62;
        }
        
        function dibujarTabla(doc, startY, datosSlice) {
            var currentY = startY;
            var rowHeight = 5;
            var headerHeight = 6.5;
            var tableWidth = finalColWidths.reduce(function(a, b) { return a + b; }, 0);
            
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(26, 60, 94);
            doc.rect(margin, currentY, tableWidth, headerHeight, 'F');
            doc.setTextColor(255, 255, 255);
            var xPos = margin;
            headers.forEach(function(h, i) {
                doc.text(h, xPos + 1.5, currentY + 4);
                xPos += finalColWidths[i];
            });
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(26, 60, 94);
            xPos = margin;
            headers.forEach(function(h, i) {
                doc.rect(xPos, currentY, finalColWidths[i], headerHeight);
                xPos += finalColWidths[i];
            });
            currentY += headerHeight;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            
            for (var idx = 0; idx < datosSlice.length; idx++) {
                var d = datosSlice[idx];
                var globalIdx = datos.indexOf(d);
                var isEven = idx % 2 === 0;
                
                var row = [String(globalIdx + 1)];
                columnas.forEach(function(col) {
                    var valor = d[col] || '';
                    if (col === 'fecha') {
                        valor = d.fechaRegistro || new Date(d.fecha).toLocaleString() || '';
                    } else if (col !== 'cedula' && col !== 'telefono') {
                        valor = valor.toUpperCase();
                    }
                    row.push(valor);
                });
                
                var maxLines = 1;
                var rowData = [];
                row.forEach(function(text, i) {
                    var maxWidth = finalColWidths[i] - 3;
                    var lines = doc.splitTextToSize(text, maxWidth);
                    rowData.push(lines);
                    if (lines.length > maxLines) maxLines = lines.length;
                });
                
                var rowHeightDynamic = Math.max(rowHeight, maxLines * 4 + 1.5);
                
                if (isEven) doc.setFillColor(248, 248, 248);
                else doc.setFillColor(255, 255, 255);
                doc.rect(margin, currentY, tableWidth, rowHeightDynamic, 'F');
                
                for (var line = 0; line < maxLines; line++) {
                    rowData.forEach(function(lines, i) {
                        var x = margin + finalColWidths.slice(0, i).reduce(function(a, b) { return a + b; }, 0);
                        var y = currentY + 2 + (line * 4);
                        var text = lines[line] || '';
                        doc.text(text, x + 1.5, y);
                    });
                }
                
                doc.setDrawColor(200, 200, 200);
                xPos = margin;
                headers.forEach(function(h, i) {
                    doc.rect(xPos, currentY, finalColWidths[i], rowHeightDynamic);
                    xPos += finalColWidths[i];
                });
                
                currentY += rowHeightDynamic;
            }
            
            return currentY;
        }
        
        function dibujarPiePagina(doc, pageNum) {
            var y = pageHeight - 5;
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.text('Página ' + pageNum, pageWidth/2, y, { align: 'center' });
        }
        
        var startY = dibujarEncabezado(doc);
        var currentIndex = 0;
        var totalRows = datos.length;
        var pageHeightAvailable = pageHeight - 10;
        
        while (currentIndex < totalRows) {
            var tempY = startY;
            var tempSlice = [];
            var headerAdded = false;
            
            for (var i = currentIndex; i < totalRows; i++) {
                var d = datos[i];
                var row = [String(i + 1)];
                columnas.forEach(function(col) {
                    var valor = d[col] || '';
                    if (col === 'fecha') {
                        valor = d.fechaRegistro || new Date(d.fecha).toLocaleString() || '';
                    } else if (col !== 'cedula' && col !== 'telefono') {
                        valor = valor.toUpperCase();
                    }
                    row.push(valor);
                });
                
                var maxLines = 1;
                row.forEach(function(text, j) {
                    var maxWidth = finalColWidths[j] - 3;
                    var lines = doc.splitTextToSize(text, maxWidth);
                    if (lines.length > maxLines) maxLines = lines.length;
                });
                
                var rowHeightDynamic = Math.max(5, maxLines * 4 + 1.5);
                
                if (!headerAdded) {
                    if (tempY + 6.5 + rowHeightDynamic + 1 > pageHeightAvailable) break;
                    tempY += 6.5;
                    headerAdded = true;
                } else {
                    if (tempY + rowHeightDynamic + 1 > pageHeightAvailable) break;
                }
                
                tempY += rowHeightDynamic + 0.5;
                tempSlice.push(d);
            }
            
            if (tempSlice.length === 0 && currentIndex < totalRows) {
                tempSlice.push(datos[currentIndex]);
                tempY = startY + 6.5;
            }
            
            startY = dibujarTabla(doc, startY, tempSlice);
            currentIndex += tempSlice.length;
            
            if (currentIndex < totalRows) {
                dibujarPiePagina(doc, pageCount);
                doc.addPage();
                pageCount++;
                startY = dibujarEncabezado(doc);
            }
        }
        
        dibujarPiePagina(doc, pageCount);
        doc.save('Censo_JMSL_' + titulo.replace(/\s/g, '_') + '_' + new Date().toISOString().slice(0,10) + '.pdf');
        showNotification('✅ Reporte PDF generado correctamente', 'success');
    } catch (error) {
        console.error('Error al generar PDF:', error);
        showNotification('❌ Error al generar PDF: ' + error.message, 'error');
    }
}

// ============================================================
// TABLA DE FIRMAS - CON FILTROS DE FECHA Y ORDEN
// ============================================================
function imprimirTablaFirmas() {
    var datos = Object.values(censoCache);
    var titulo = 'Todos los Sectores';
    var bloqueSeleccionado = '';
    var sectorSeleccionado = '';
    
    // Si es encuestador, filtrar por su sector
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        datos = datos.filter(function(d) { return d.sector === currentUser.sector; });
        titulo = 'Sector: ' + currentUser.sector;
        sectorSeleccionado = currentUser.sector;
    } else {
        // Solo admin puede usar filtros
        var reportType = document.getElementById('reportType').value;
        if (reportType === 'bloque') {
            var bloque = document.getElementById('reportBloque').value;
            if (!bloque) { showNotification('⚠️ Seleccione un bloque', 'warning'); return; }
            datos = datos.filter(function(d) { return d.bloque === bloque; });
            titulo = 'Bloque ' + bloque;
            bloqueSeleccionado = bloque;
        } else if (reportType === 'sector') {
            var sector = document.getElementById('reportSector').value;
            if (!sector) { showNotification('⚠️ Seleccione un sector', 'warning'); return; }
            var bloque2 = document.getElementById('reportBloque').value;
            datos = datos.filter(function(d) { return d.sector === sector; });
            titulo = 'Sector: ' + sector;
            sectorSeleccionado = sector;
            bloqueSeleccionado = bloque2;
        }
        
        // Filtro por fecha
        var fechaDesde = document.getElementById('reportFechaDesde').value;
        var fechaHasta = document.getElementById('reportFechaHasta').value;
        
        if (fechaDesde) {
            var desde = new Date(fechaDesde).getTime();
            datos = datos.filter(function(d) { return new Date(d.fecha).getTime() >= desde; });
        }
        if (fechaHasta) {
            var hasta = new Date(fechaHasta).getTime() + 86400000;
            datos = datos.filter(function(d) { return new Date(d.fecha).getTime() <= hasta; });
        }
        
        // Ordenamiento
        var orderBy = document.getElementById('reportOrderBy').value;
        var orderDir = document.getElementById('reportOrderDir').value;
        
        datos.sort(function(a, b) {
            var valA = a[orderBy] || '';
            var valB = b[orderBy] || '';
            if (orderBy === 'fecha') {
                valA = new Date(valA).getTime() || 0;
                valB = new Date(valB).getTime() || 0;
            }
            if (valA < valB) return orderDir === 'asc' ? -1 : 1;
            if (valA > valB) return orderDir === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    if (datos.length === 0) {
        showNotification('⚠️ No hay datos para generar la tabla de firmas', 'warning');
        return;
    }
    
    var presidente = null;
    if (bloqueSeleccionado && sectorSeleccionado) {
        presidente = getPresidentePorSector(bloqueSeleccionado, sectorSeleccionado);
    }
    if (!presidente && bloqueSeleccionado) {
        var presidentes = Object.values(presidentesCache);
        for (var i = 0; i < presidentes.length; i++) {
            if (presidentes[i].bloque === bloqueSeleccionado) { presidente = presidentes[i]; break; }
        }
    }
    if (!presidente && sectorSeleccionado) {
        var presidentes2 = Object.values(presidentesCache);
        for (var j = 0; j < presidentes2.length; j++) {
            if (presidentes2[j].sector === sectorSeleccionado) { presidente = presidentes2[j]; break; }
        }
    }
    
    // Ordenar por calle y nombre para mejor visualización
    datos.sort(function(a, b) {
        var calleA = a.calle || '';
        var calleB = b.calle || '';
        if (calleA !== calleB) return calleA.localeCompare(calleB);
        return (a.nombre || '').localeCompare(b.nombre || '');
    });
    
    var ventana = window.open('', '_blank', 'width=900,height=600');
    if (!ventana) {
        showNotification('⚠️ Permita ventanas emergentes para imprimir', 'warning');
        return;
    }
    
    var logoBase64 = '';
    try {
        var logoImg = document.querySelector('.nav-logo') && document.querySelector('.nav-logo').src || '';
        if (logoImg) logoBase64 = logoImg;
    } catch(e) {}
    
    var fechaDesde2 = document.getElementById('reportFechaDesde') && document.getElementById('reportFechaDesde').value || '';
    var fechaHasta2 = document.getElementById('reportFechaHasta') && document.getElementById('reportFechaHasta').value || '';
    var orderBy2 = document.getElementById('reportOrderBy') && document.getElementById('reportOrderBy').value || 'nombre';
    var orderDir2 = document.getElementById('reportOrderDir') && document.getElementById('reportOrderDir').value || 'asc';
    
    var fechaDesdeStr = fechaDesde2 ? 'Desde: ' + fechaDesde2 : '';
    var fechaHastaStr = fechaHasta2 ? 'Hasta: ' + fechaHasta2 : '';
    var filtrosStr = [fechaDesdeStr, fechaHastaStr].filter(function(f) { return f; }).join(' | ');
    var ordenStr = 'Orden: ' + orderBy2 + ' (' + (orderDir2 === 'asc' ? 'Ascendente' : 'Descendente') + ')';
    
    var html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Tabla de Firmas - Junta Municipal San Luis</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; padding: 30px; background: white; }
            .header { text-align: center; border-bottom: 3px solid #B8860B; padding-bottom: 15px; margin-bottom: 20px; }
            .header .logo { display: block; margin: 0 auto 10px; max-width: 80px; max-height: 80px; }
            .header h1 { color: #1a3c5e; font-size: 22px; letter-spacing: 2px; }
            .header .rnc { font-size: 12px; color: #6b7a8f; }
            .header .ubicacion { font-size: 12px; color: #6b7a8f; }
            .header h2 { color: #B8860B; font-size: 16px; font-weight: normal; }
            .header p { color: #6b7a8f; font-size: 13px; margin-top: 5px; }
            .header .fecha { font-weight: bold; color: #1a3c5e; }
            .header .filtros { font-size: 11px; color: #6b7a8f; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #1a3c5e; color: white; padding: 10px 12px; text-align: left; font-size: 13px; border: 1px solid #1a3c5e; }
            td { padding: 10px 12px; border: 1px solid #ccc; font-size: 12px; vertical-align: middle; }
            .firma-cell { width: 200px; text-align: center; font-size: 11px; color: #999; }
            .firma-line { border-bottom: 1px solid #333; height: 30px; margin-bottom: 5px; }
            .numero-cell { text-align: center; font-weight: bold; width: 40px; }
            .firma-container { display: flex; justify-content: space-around; margin-top: 30px; padding-top: 20px; border-top: 2px solid #B8860B; }
            .firma-box { text-align: center; width: 30%; }
            .firma-box .linea { border-bottom: 1px solid #000; height: 30px; margin: 0 auto 5px; width: 90%; }
            .firma-box .nombre { font-weight: bold; font-size: 13px; color: #1a3c5e; }
            .firma-box .cargo { font-size: 11px; color: #6b7a8f; }
            .firma-centro { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #B8860B; }
            .firma-centro .linea { border-bottom: 1px solid #000; height: 30px; margin: 0 auto 5px; width: 60%; }
            .firma-centro .nombre { font-weight: bold; font-size: 13px; color: #1a3c5e; }
            .firma-centro .cedula { font-size: 10px; color: #999; margin-top: 2px; }
            .firma-centro .cargo { font-size: 11px; color: #6b7a8f; }
            .btn-imprimir { position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: #B8860B; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold; z-index: 1000; }
            .btn-imprimir:hover { background: #8B6900; }
            .info-adicional { font-size: 11px; color: #6b7a8f; margin-top: 5px; text-align: center; }
            @media print { .btn-imprimir { display: none; } body { padding: 15px; } }
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
            ${filtrosStr ? '<p class="filtros">' + filtrosStr + '</p>' : ''}
            <p class="info-adicional">${ordenStr}</p>
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
    
    datos.forEach(function(d, index) {
        html += `
            <tr>
                <td class="numero-cell">${index + 1}</td>
                <td>${d.cedula || ''}</td>
                <td>${(d.nombre || '').toUpperCase()}</td>
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
            </div>
            <div class="firma-box">
                <div class="linea"></div>
                <div class="nombre">DOMINGO CARSADO</div>
                <div class="cargo">ENCARGADO</div>
            </div>
        </div>
    `;
    
    if (presidente) {
        html += `
        <div class="firma-centro">
            <div class="linea"></div>
            <div class="nombre">${presidente.nombre}</div>
            <div class="cedula">Cédula: ${presidente.cedula || 'N/A'}</div>
            <div class="cargo">PRESIDENTE DE COMITÉ</div>
        </div>
        `;
    } else {
        html += `
        <div class="firma-centro">
            <div class="linea"></div>
            <div class="nombre" style="color:#999;font-size:11px;">(Sin presidente registrado)</div>
            <div class="cargo">PRESIDENTE DE COMITÉ</div>
        </div>
        `;
    }
    
    html += `
        <div style="text-align:center;margin-top:15px;font-size:10px;color:#ccc;">
            Documento generado por el Sistema de Censo Electoral - Junta Municipal San Luis
        </div>
        <script>
            setTimeout(function() { window.print(); }, 800);
        <\/script>
    </body>
    </html>
    `;
    
    ventana.document.write(html);
    ventana.document.close();
}
