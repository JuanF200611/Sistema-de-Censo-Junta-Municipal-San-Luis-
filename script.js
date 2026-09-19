// ============================================================
// CONFIGURACIÓN FIREBASE (API KEY REAL)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyCbHE8G6_ORPGvVs9C8sCANgcIfNXVmaRQ",
    authDomain: "departamentoasuntoscomunitario.firebaseapp.com",
    databaseURL: "https://departamentoasuntoscomunitario-default-rtdb.firebaseio.com",
    projectId: "departamentoasuntoscomunitario",
    storageBucket: "departamentoasuntoscomunitario.firebasestorage.app",
    messagingSenderId: "381465471430",
    appId: "1:381465471430:web:2a3a7e60b969a5ce1eeac7",
    measurementId: "G-JYHD71MZSK"
};

let firebaseInicializado = false;
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        firebaseInicializado = true;
        console.log('✅ Firebase inicializado correctamente');
    } else {
        firebaseInicializado = true;
    }
} catch (error) {
    console.error('❌ Error al inicializar Firebase:', error);
    firebaseInicializado = false;
}

const db = firebaseInicializado ? firebase.database() : null;

// ============================================================
// LIMPIEZA AUTOMÁTICA DE LOCALSTORAGE (NO SE USA RESPALDO LOCAL)
// ============================================================
(function limpiarLocalStorage() {
    try {
        var claves = Object.keys(localStorage).filter(function(k) {
            return k.indexOf('censo_') === 0;
        });
        claves.forEach(function(k) {
            localStorage.removeItem(k);
        });
        if (claves.length > 0) {
            console.log('🧹 LocalStorage limpiado (' + claves.length + ' claves eliminadas)');
        }
    } catch (e) {
        console.warn('No se pudo limpiar localStorage:', e);
    }
})();

// Stubs de compatibilidad (ya no se usa respaldo local)
function guardarEnLocal(clave, datos) { /* deshabilitado */ }
function guardarEnLocalSeguro(clave, datos) { /* deshabilitado */ }
function obtenerDeLocal(clave) { return null; }

// ============================================================
// CONFIGURACIÓN CLOUDINARY
// ============================================================
const CLOUDINARY_CLOUD_NAME = 'foj2whcu';
const CLOUDINARY_UPLOAD_PRESET = 'censo_fotos';

async function subirImagenCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Error al subir imagen');
        }
        
        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Error Cloudinary:', error);
        throw error;
    }
}

// ============================================================
// UTILIDADES DE SEGURIDAD
// ============================================================
function normalizar(str) {
    return (str || '').toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function safeString(val) {
    if (val === null || val === undefined) return '';
    return String(val);
}

function snapshotTieneDatos(snapshot) {
    if (!snapshot) return false;
    if (typeof snapshot.exists === 'function' && !snapshot.exists()) return false;
    const val = snapshot.val();
    return val !== null && val !== undefined && typeof val === 'object' && Object.keys(val).length > 0;
}

function actualizarIndicadorConexion(conectado) {
    let indicador = document.getElementById('indicadorConexion');
    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'indicadorConexion';
        indicador.style.cssText = [
            'position: fixed',
            'bottom: 20px',
            'left: 20px',
            'z-index: 9998',
            'padding: 8px 14px',
            'border-radius: 20px',
            "font-family: 'Poppins', sans-serif",
            'font-size: 0.75rem',
            'font-weight: 600',
            'display: flex',
            'align-items: center',
            'gap: 6px',
            'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
            'transition: all 0.3s ease',
            'pointer-events: none'
        ].join(';');
        document.body.appendChild(indicador);
    }
    
    if (conectado) {
        indicador.style.background = '#27ae60';
        indicador.style.color = 'white';
        indicador.style.opacity = '1';
        indicador.innerHTML = '<i class="fas fa-wifi"></i> En línea';
        setTimeout(function() {
            if (indicador.style.background === 'rgb(39, 174, 96)') {
                indicador.style.opacity = '0';
            }
        }, 3000);
    } else {
        indicador.style.background = '#e74c3c';
        indicador.style.color = 'white';
        indicador.style.opacity = '1';
        indicador.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Sin conexión';
    }
}

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
let votantesCache = {};
let listenersActivos = false;
let selectoresInicializados = false;
let cropper = null;
let mediaStream = null;
let eleccionActiva = false;
let usandoFirebase = firebaseInicializado;
let marcaDeAguaActiva = false;

// ============================================================
// REFERENCIAS EN TIEMPO REAL
// ============================================================
let bloquesListener = null;
let callesListener = null;
let encuestadoresListener = null;
let presidentesListener = null;
let censoListener = null;
let votantesListener = null;
let connectedListener = null;

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

function limpiarCedula(cedula) {
    return (cedula || '').replace(/\D/g, '');
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
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
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
// NÚMERO DE SECUENCIA POR SECTOR
// ============================================================
function obtenerUltimoNumeroSecuenciaPorSector(sector) {
    var items = Object.values(censoCache);
    var itemsSector = items.filter(function(item) { return item && item.sector === sector; });
    
    if (itemsSector.length === 0) return 0;
    
    var maxNumero = 0;
    itemsSector.forEach(function(item) {
        if (item.numeroSecuencia && parseInt(item.numeroSecuencia) > maxNumero) {
            maxNumero = parseInt(item.numeroSecuencia);
        }
    });
    
    if (maxNumero === 0) {
        return itemsSector.length;
    }
    return maxNumero;
}

function asignarNumeroSecuencia(sector) {
    var ultimoNumero = obtenerUltimoNumeroSecuenciaPorSector(sector);
    return ultimoNumero + 1;
}

// ============================================================
// CÁMARA
// ============================================================
async function abrirCamara() {
    const videoContainer = document.getElementById('videoContainer');
    const video = document.getElementById('videoCamara');
    
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        video.srcObject = mediaStream;
        videoContainer.style.display = 'block';
        await video.play();
    } catch (error) {
        showNotification('❌ No se pudo acceder a la cámara: ' + error.message, 'error');
    }
}

function capturarFoto() {
    const video = document.getElementById('videoCamara');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(function(blob) {
        const file = new File([blob], 'foto_camara.jpg', { type: 'image/jpeg' });
        const input = document.getElementById('fotoCedula');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        cerrarCamara();
        previsualizarFoto();
        showNotification('✅ Foto capturada correctamente', 'success');
    }, 'image/jpeg', 0.92);
}

function cerrarCamara() {
    const videoContainer = document.getElementById('videoContainer');
    const video = document.getElementById('videoCamara');
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (video) video.srcObject = null;
    if (videoContainer) videoContainer.style.display = 'none';
}

// ============================================================
// CROPPER
// ============================================================
function previsualizarFoto() {
    const fileInput = document.getElementById('fotoCedula');
    const previewDiv = document.getElementById('previewFoto');
    const previewImg = document.getElementById('previewImg');
    const cropContainer = document.getElementById('cropContainer');
    
    if (fileInput.files && fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageToCrop = document.getElementById('imageToCrop');
            imageToCrop.src = e.target.result;
            cropContainer.style.display = 'block';
            previewDiv.style.display = 'none';
            
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            
            cropper = new Cropper(imageToCrop, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 0.8,
                minCropBoxWidth: 100,
                minCropBoxHeight: 100,
                movable: true,
                zoomable: true,
                rotatable: true,
                scalable: true
            });
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        previewDiv.style.display = 'none';
        cropContainer.style.display = 'none';
    }
}

function rotarImagen(degrees) {
    if (cropper) {
        cropper.rotate(degrees);
    }
}

function aplicarCrop() {
    if (!cropper) return;
    
    const croppedCanvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
    
    if (!croppedCanvas) {
        showNotification('❌ Error al recortar la imagen', 'error');
        return;
    }
    
    croppedCanvas.toBlob(function(blob) {
        const file = new File([blob], 'foto_recortada.jpg', { type: 'image/jpeg' });
        const input = document.getElementById('fotoCedula');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        
        const previewImg = document.getElementById('previewImg');
        previewImg.src = croppedCanvas.toDataURL('image/jpeg', 0.85);
        document.getElementById('previewFoto').style.display = 'block';
        document.getElementById('cropContainer').style.display = 'none';
        document.getElementById('fotoInfo').textContent = `📷 Foto: ${Math.round(file.size / 1024)} KB (optimizada)`;
        
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        showNotification('✅ Foto recortada y optimizada correctamente', 'success');
    }, 'image/jpeg', 0.85);
}

function cancelarCrop() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('cropContainer').style.display = 'none';
    document.getElementById('fotoCedula').value = '';
}

function eliminarFotoSeleccionada() {
    const fileInput = document.getElementById('fotoCedula');
    const previewDiv = document.getElementById('previewFoto');
    fileInput.value = '';
    previewDiv.style.display = 'none';
    document.getElementById('cropContainer').style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
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
        if (usandoFirebase) {
            iniciarEscuchaTiempoReal();
        } else {
            showNotification('⚠️ Sin conexión a Firebase', 'warning');
        }
        cargarDatosIniciales();
        showNotification('✅ Bienvenido Administrador', 'success');
    } else {
        verificarEncuestador(user, pass);
    }
});

function verificarEncuestador(user, pass) {
    if (!usandoFirebase || !db) {
        document.getElementById('loginError').textContent = 'Sin conexión a Firebase. No se puede verificar.';
        showNotification('❌ Sin conexión', 'error');
        return;
    }
    
    showLoading('Verificando credenciales...');
    
    db.ref('encuestadores').once('value')
        .then(function(snapshot) {
            hideLoading();
            const data = snapshot.val();
            let encontrado = false;
            
            if (data) {
                Object.keys(data).forEach(function(key) {
                    const encuestador = data[key];
                    if (encuestador && encuestador.usuario === user && encuestador.contraseña === pass) {
                        encontrado = true;
                        encuestadoresCache[key] = encuestador;
                        loginEncuestador(encuestador, key);
                    }
                });
            }
            
            if (!encontrado) {
                document.getElementById('loginError').textContent = 'Usuario o contraseña incorrectos';
                showNotification('❌ Usuario o contraseña incorrectos', 'error');
            }
        })
        .catch(function(error) {
            hideLoading();
            document.getElementById('loginError').textContent = 'Error al verificar: ' + error.message;
            showNotification('❌ Error al verificar credenciales', 'error');
        });
}

function loginEncuestador(encuestador, key) {
    currentUser = {
        username: encuestador.usuario,
        name: encuestador.nombre,
        role: 'encuestador',
        id: key,
        sector: encuestador.sector || null
    };
    document.getElementById('userNameDisplay').textContent = encuestador.nombre;
    if (currentUser.sector) {
        document.getElementById('sectorDisplay').textContent = '📍 Sector asignado: ' + currentUser.sector;
        document.getElementById('reportSectorInfo').textContent = '📍 Reportes filtrados por sector: ' + currentUser.sector;
    }
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('loginError').textContent = '';
    mostrarMenuAdmin(false);
    mostrarFiltrosAdmin(false);
    mostrarMenuVotacion(false);
    if (usandoFirebase) {
        iniciarEscuchaTiempoReal();
    }
    cargarDatosIniciales();
    document.getElementById('censoEncuestador').value = encuestador.nombre;
    document.getElementById('censoEncuestador').disabled = true;
    showNotification('✅ Bienvenido ' + encuestador.nombre, 'success');
}

function mostrarMenuAdmin(esAdmin) {
    document.getElementById('menuAdmin').style.display = esAdmin ? 'block' : 'none';
    document.getElementById('menuReportes').style.display = esAdmin ? 'block' : 'none';
    document.getElementById('menuVotacion').style.display = esAdmin ? 'block' : 'none';
    document.getElementById('btnAdmin').style.display = esAdmin ? 'inline-flex' : 'none';
    document.getElementById('btnReportes').style.display = esAdmin ? 'inline-flex' : 'none';
    document.getElementById('btnVotacion').style.display = esAdmin ? 'inline-flex' : 'none';
}

function mostrarMenuVotacion(visible) {
    document.getElementById('menuVotacion').style.display = visible ? 'block' : 'none';
    document.getElementById('btnVotacion').style.display = visible ? 'inline-flex' : 'none';
}

function mostrarFiltrosAdmin(esAdmin) {
    const reportFiltros = document.getElementById('reportFiltrosAdmin');
    if (reportFiltros) reportFiltros.style.display = esAdmin ? 'block' : 'none';
}

function logout() {
    if (confirm('¿Está seguro que desea salir?')) {
        if (connectedListener) { connectedListener.off(); connectedListener = null; }
        if (bloquesListener) { bloquesListener.off(); bloquesListener = null; }
        if (callesListener) { callesListener.off(); callesListener = null; }
        if (encuestadoresListener) { encuestadoresListener.off(); encuestadoresListener = null; }
        if (presidentesListener) { presidentesListener.off(); presidentesListener = null; }
        if (censoListener) { censoListener.off(); censoListener = null; }
        if (votantesListener) { votantesListener.off(); votantesListener = null; }
        
        listenersActivos = false;
        selectoresInicializados = false;
        currentUser = null;
        cerrarCamara();
        
        bloquesCache = {};
        callesCache = {};
        encuestadoresCache = {};
        presidentesCache = {};
        censoCache = {};
        votantesCache = {};
        
        const indicador = document.getElementById('indicadorConexion');
        if (indicador) indicador.remove();
        
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
    const seccion = document.getElementById(sectionId);
    if (seccion) seccion.classList.add('active');
    
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    const link = document.querySelector('.nav-menu a[onclick*="' + sectionId + '"]');
    if (link) link.classList.add('active');
    
    if (sectionId === 'reports') {
        cargarDatosReporte();
    }
    if (sectionId === 'adminPanel' && currentUser && currentUser.role === 'admin') {
        cargarTodasEncuestas();
        cargarPresidentesUI();
        cargarVotantesAdmin();
    }
    if (sectionId === 'misEncuestas') {
        cargarMisEncuestas();
    }
    if (sectionId === 'votacion') {
        cargarVotantesHoy();
        cargarBloquesVotacion();
    }
    
    document.getElementById('navMenu').classList.remove('open');
}

document.getElementById('navToggle').addEventListener('click', function() {
    document.getElementById('navMenu').classList.toggle('open');
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const tab = document.getElementById(this.dataset.tab);
        if (tab) tab.classList.add('active');
        
        if (this.dataset.tab === 'tabCalles') cargarCallesUI();
        if (this.dataset.tab === 'tabUsuarios') cargarEncuestadoresUI();
        if (this.dataset.tab === 'tabPresidentes') cargarPresidentesUI();
        if (this.dataset.tab === 'tabEncuestas') cargarTodasEncuestas();
        if (this.dataset.tab === 'tabVotantes') cargarVotantesAdmin();
    });
});

// ============================================================
// ESCUCHA EN TIEMPO REAL (FIREBASE)
// ============================================================
function iniciarEscuchaTiempoReal() {
    if (!usandoFirebase || !db) {
        console.warn('⚠️ Firebase no disponible');
        return;
    }
    
    if (censoListener && bloquesListener) {
        console.log('ℹ️ Listeners ya activos');
        return;
    }
    
    console.log('🔌 Iniciando listeners de Firebase...');
    listenersActivos = true;
    
    connectedListener = db.ref('.info/connected');
    connectedListener.on('value', function(snap) {
        const conectado = snap.val() === true;
        usandoFirebase = conectado;
        actualizarIndicadorConexion(conectado);
        
        if (!conectado) {
            console.warn('🔴 Desconectado de Firebase');
            showNotification('⚠️ Sin conexión a Firebase.', 'warning', 4000);
        } else {
            console.log('🟢 Conectado a Firebase');
            setTimeout(function() {
                sincronizarTodoDesdeFirebase();
            }, 800);
        }
    });
    
    // BLOQUES
    bloquesListener = db.ref('bloques');
    bloquesListener.on('value', function(snapshot) {
        try {
            const nuevos = {};
            snapshot.forEach(function(child) {
                const data = child.val();
                const key = child.key;
                if (!data || !data.bloque) return;
                if (!nuevos[data.bloque]) nuevos[data.bloque] = [];
                nuevos[data.bloque].push({ sector: data.sector, key: key });
            });
            
            Object.keys(nuevos).forEach(function(bloque) {
                nuevos[bloque].sort(function(a, b) {
                    return safeString(a && a.sector).localeCompare(safeString(b && b.sector));
                });
            });
            
            bloquesCache = nuevos;
            actualizarUI('bloques');
            actualizarSelectoresCenso();
            cargarBloquesParaCalle();
            cargarBloquesParaPresidente();
            cargarBloquesVotacion();
            cargarSelectoresReporte();
            cargarSectoresEnAsignacion();
        } catch (e) {
            console.error('Error procesando bloques:', e);
        }
    }, function(error) {
        console.error('❌ Error en listener de bloques:', error);
    });
    
    // CALLES
    callesListener = db.ref('calles');
    callesListener.on('value', function(snapshot) {
        try {
            const nuevos = {};
            snapshot.forEach(function(child) {
                const data = child.val();
                const key = child.key;
                if (!data || !data.bloque || !data.sector || !data.nombre) return;
                const id = data.bloque + '_' + data.sector + '_' + data.nombre;
                nuevos[id] = Object.assign({}, data, { key: key });
            });
            
            callesCache = nuevos;
            actualizarUI('calles');
            actualizarSelectoresCenso();
        } catch (e) {
            console.error('Error procesando calles:', e);
        }
    }, function(error) {
        console.error('❌ Error en listener de calles:', error);
    });
    
    // ENCUESTADORES
    encuestadoresListener = db.ref('encuestadores');
    encuestadoresListener.on('value', function(snapshot) {
        try {
            const nuevos = {};
            snapshot.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            
            encuestadoresCache = nuevos;
            actualizarUI('encuestadores');
            cargarSelectorEncuestadores();
            cargarSectoresEnAsignacion();
        } catch (e) {
            console.error('Error procesando encuestadores:', e);
        }
    }, function(error) {
        console.error('❌ Error en listener de encuestadores:', error);
    });
    
    // PRESIDENTES
    presidentesListener = db.ref('presidentes');
    presidentesListener.on('value', function(snapshot) {
        try {
            const nuevos = {};
            snapshot.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            
            presidentesCache = nuevos;
            actualizarUI('presidentes');
            cargarPresidentesUI();
        } catch (e) {
            console.error('Error procesando presidentes:', e);
        }
    }, function(error) {
        console.error('❌ Error en listener de presidentes:', error);
    });
    
    // CENSO
    censoListener = db.ref('censo');
    censoListener.on('value', function(snapshot) {
        try {
            const nuevos = {};
            snapshot.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            
            const cantidadAnterior = Object.keys(censoCache).length;
            const cantidadNueva = Object.keys(nuevos).length;
            
            censoCache = nuevos;
            actualizarUI('censo');
            
            console.log('📊 Censo actualizado: ' + cantidadNueva + ' registros (antes: ' + cantidadAnterior + ')');
            
            const seccionActiva = document.querySelector('.section.active');
            if (seccionActiva) {
                const id = seccionActiva.id;
                if (id === 'misEncuestas') cargarMisEncuestas();
                else if (id === 'reports') cargarDatosReporte();
                else if (id === 'adminPanel') {
                    const tabActivo = document.querySelector('.tab-content.active');
                    if (tabActivo && tabActivo.id === 'tabEncuestas') cargarTodasEncuestas();
                } else if (id === 'censusForm') {
                    cargarUltimasEncuestas();
                }
            }
        } catch (e) {
            console.error('Error procesando censo:', e);
        }
    }, function(error) {
        console.error('❌ Error en listener de censo:', error);
        showNotification('⚠️ Error al leer el censo: ' + error.message, 'error', 5000);
    });
    
    // VOTANTES
    votantesListener = db.ref('votantes');
    votantesListener.on('value', function(snapshot) {
        try {
            const nuevos = {};
            snapshot.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            
            votantesCache = nuevos;
            actualizarUI('votantes');
            
            const seccionActiva = document.querySelector('.section.active');
            if (seccionActiva) {
                const id = seccionActiva.id;
                if (id === 'votacion') cargarVotantesHoy();
                else if (id === 'adminPanel') {
                    const tabActivo = document.querySelector('.tab-content.active');
                    if (tabActivo && tabActivo.id === 'tabVotantes') cargarVotantesAdmin();
                }
            }
            actualizarEstadisticas();
        } catch (e) {
            console.error('Error procesando votantes:', e);
        }
    }, function(error) {
        console.error('❌ Error en listener de votantes:', error);
    });
    
    setTimeout(function() {
        sincronizarTodoDesdeFirebase();
    }, 2000);
    
    console.log('✅ Listeners de Firebase iniciados');
}

// ============================================================
// SINCRONIZACIÓN FORZADA
// ============================================================
async function sincronizarTodoDesdeFirebase() {
    if (!db) return;
    
    try {
        console.log('🔄 Sincronizando datos desde Firebase...');
        
        const resultados = await Promise.all([
            db.ref('censo').once('value'),
            db.ref('bloques').once('value'),
            db.ref('calles').once('value'),
            db.ref('encuestadores').once('value'),
            db.ref('presidentes').once('value'),
            db.ref('votantes').once('value')
        ]);
        
        const snapCenso = resultados[0];
        const snapBloques = resultados[1];
        const snapCalles = resultados[2];
        const snapEnc = resultados[3];
        const snapPres = resultados[4];
        const snapVot = resultados[5];
        
        if (snapshotTieneDatos(snapCenso)) {
            const nuevos = {};
            snapCenso.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            censoCache = nuevos;
            console.log('✅ Censo sincronizado: ' + Object.keys(censoCache).length + ' registros');
        } else {
            console.warn('⚠️ Censo vacío en Firebase');
            censoCache = {};
        }
        
        if (snapshotTieneDatos(snapBloques)) {
            const nuevos = {};
            snapBloques.forEach(function(child) {
                const data = child.val();
                if (!data || !data.bloque) return;
                if (!nuevos[data.bloque]) nuevos[data.bloque] = [];
                nuevos[data.bloque].push({ sector: data.sector, key: child.key });
            });
            Object.keys(nuevos).forEach(function(b) {
                nuevos[b].sort(function(a, c) {
                    return safeString(a && a.sector).localeCompare(safeString(c && c.sector));
                });
            });
            bloquesCache = nuevos;
        } else {
            bloquesCache = {};
        }
        
        if (snapshotTieneDatos(snapCalles)) {
            const nuevos = {};
            snapCalles.forEach(function(child) {
                const data = child.val();
                if (!data || !data.bloque || !data.sector || !data.nombre) return;
                const id = data.bloque + '_' + data.sector + '_' + data.nombre;
                nuevos[id] = Object.assign({}, data, { key: child.key });
            });
            callesCache = nuevos;
        } else {
            callesCache = {};
        }
        
        if (snapshotTieneDatos(snapEnc)) {
            const nuevos = {};
            snapEnc.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            encuestadoresCache = nuevos;
        } else {
            encuestadoresCache = {};
        }
        
        if (snapshotTieneDatos(snapPres)) {
            const nuevos = {};
            snapPres.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            presidentesCache = nuevos;
        } else {
            presidentesCache = {};
        }
        
        if (snapshotTieneDatos(snapVot)) {
            const nuevos = {};
            snapVot.forEach(function(child) {
                const data = child.val();
                if (data) nuevos[child.key] = data;
            });
            votantesCache = nuevos;
        } else {
            votantesCache = {};
        }
        
        actualizarUI('todos');
        console.log('✅ Sincronización completa terminada');
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
    }
}

// ============================================================
// ACTUALIZAR UI
// ============================================================
function actualizarUI(tipo) {
    try {
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
        if (tipo === 'votantes' || tipo === 'todos') {
            actualizarEstadisticas();
        }
    } catch (e) {
        console.error('Error en actualizarUI(' + tipo + '):', e);
    }
}

// ============================================================
// CARGAR DATOS INICIALES
// ============================================================
function cargarDatosIniciales() {
    try {
        actualizarUI('todos');
        cargarSelectoresCenso();
        
        if (currentUser && currentUser.name && currentUser.role === 'encuestador') {
            const el = document.getElementById('censoEncuestador');
            if (el) {
                el.value = currentUser.name;
                el.disabled = true;
            }
        } else if (currentUser && currentUser.name) {
            const el = document.getElementById('censoEncuestador');
            if (el) el.value = currentUser.name;
        }
        
        const fotoInput = document.getElementById('fotoCedula');
        if (fotoInput && !fotoInput.dataset.listenerAttached) {
            fotoInput.addEventListener('change', previsualizarFoto);
            fotoInput.dataset.listenerAttached = '1';
        }
        
        var inputCedula = document.getElementById('cedula');
        var inputTelefono = document.getElementById('telefono');
        
        if (inputCedula && !inputCedula.dataset.listenerAttached) {
            inputCedula.addEventListener('input', function() { formatearCedula(this); });
            inputCedula.addEventListener('paste', function() { setTimeout(function() { formatearCedula(inputCedula); }, 10); });
            inputCedula.dataset.listenerAttached = '1';
        }
        
        if (inputTelefono && !inputTelefono.dataset.listenerAttached) {
            inputTelefono.addEventListener('input', function() { formatearTelefono(this); });
            inputTelefono.addEventListener('paste', function() { setTimeout(function() { formatearTelefono(inputTelefono); }, 10); });
            inputTelefono.dataset.listenerAttached = '1';
        }
        
        var tipoDocumento = document.getElementById('tipoDocumento');
        if (tipoDocumento && !tipoDocumento.dataset.listenerAttached) {
            tipoDocumento.addEventListener('change', function() {
                var nacionalidadSelect = document.getElementById('nacionalidad');
                if (this.value === 'cedula') {
                    nacionalidadSelect.value = 'dominicana';
                    nacionalidadSelect.disabled = true;
                    showNotification('✅ Nacionalidad: Dominicana', 'info', 2000);
                } else {
                    nacionalidadSelect.disabled = false;
                    nacionalidadSelect.value = '';
                }
            });
            tipoDocumento.dataset.listenerAttached = '1';
        }
        
        setTimeout(function() {
            cargarBloquesParaCalle();
            cargarBloquesParaPresidente();
            cargarBloquesVotacion();
            cargarSelectoresReporte();
            cargarSectoresEnAsignacion();
            cargarVotantesHoy();
        }, 500);
    } catch (e) {
        console.error('Error en cargarDatosIniciales:', e);
    }
}

// ============================================================
// SECTORES EN ASIGNACIÓN
// ============================================================
function cargarSectoresEnAsignacion() {
    var select = document.getElementById('encuestadorSectorAsignado');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar Sector</option>';
    Object.keys(bloquesCache).forEach(function(bloque) {
        var sectores = bloquesCache[bloque] || [];
        if (!Array.isArray(sectores)) return;
        sectores.forEach(function(s) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = safeString(s.sector);
            opt.textContent = bloque + ' - ' + safeString(s.sector);
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
    
    if (!selectBloque || !selectSector || !selectCalle) return;
    
    selectBloque.innerHTML = '<option value="">Seleccionar Bloque</option>';
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        var ia = ordenRomanos.indexOf(a);
        var ib = ordenRomanos.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
    });
    
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        bloques = bloques.filter(function(bloque) {
            var sectores = bloquesCache[bloque] || [];
            return sectores.some(function(s) { return s && s.sector === currentUser.sector; });
        });
    }
    
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
    
    if (currentUser && currentUser.name && currentUser.role === 'encuestador') {
        const el = document.getElementById('censoEncuestador');
        if (el) {
            el.value = currentUser.name;
            el.disabled = true;
        }
    } else if (currentUser && currentUser.name) {
        const el = document.getElementById('censoEncuestador');
        if (el) el.value = currentUser.name;
    }
    
    cargarSelectorEncuestadores();
    selectoresInicializados = true;
}

function cargarSectoresPorBloque(bloque) {
    var selectSector = document.getElementById('censoSector');
    var selectCalle = document.getElementById('censoCalle');
    if (!selectSector || !selectCalle) return;
    selectSector.innerHTML = '<option value="">Seleccionar Sector</option>';
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    if (bloque && bloquesCache[bloque]) {
        var sectores = bloquesCache[bloque] || [];
        if (!Array.isArray(sectores)) sectores = [];
        if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
            sectores = sectores.filter(function(s) { return s && s.sector === currentUser.sector; });
        }
        sectores.forEach(function(s) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = safeString(s.sector);
            opt.textContent = safeString(s.sector);
            selectSector.appendChild(opt);
        });
    }
}

function cargarCallesPorBloqueYSector(bloque, sector) {
    var selectCalle = document.getElementById('censoCalle');
    if (!selectCalle) return;
    selectCalle.innerHTML = '<option value="">Seleccionar Calle</option>';
    
    if (bloque && sector) {
        var calles = Object.values(callesCache).filter(function(c) {
            return c && c.bloque === bloque && c.sector === sector;
        });
        calles.sort(function(a, b) {
            return safeString(a && a.nombre).localeCompare(safeString(b && b.nombre));
        });
        calles.forEach(function(c) {
            if (!c) return;
            var opt = document.createElement('option');
            opt.value = safeString(c.nombre);
            opt.textContent = safeString(c.nombre);
            selectCalle.appendChild(opt);
        });
    }
}

function actualizarSelectoresCenso() {
    if (!selectoresInicializados) {
        cargarSelectoresCenso();
        return;
    }
    
    try {
        var selectBloque = document.getElementById('censoBloque');
        if (!selectBloque) return;
        var currentBloque = selectBloque.value;
        var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
        var bloques = Object.keys(bloquesCache).sort(function(a, b) {
            var ia = ordenRomanos.indexOf(a);
            var ib = ordenRomanos.indexOf(b);
            if (ia === -1) ia = 999;
            if (ib === -1) ib = 999;
            return ia - ib;
        });
        
        if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
            bloques = bloques.filter(function(bloque) {
                var sectores = bloquesCache[bloque] || [];
                return sectores.some(function(s) { return s && s.sector === currentUser.sector; });
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
    } catch (e) {
        console.error('Error en actualizarSelectoresCenso:', e);
    }
}

// ============================================================
// BLOQUES Y SECTORES
// ============================================================
function cargarBloquesUI() {
    var container = document.getElementById('bloqueList');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
        var sortedBloques = Object.keys(bloquesCache).sort(function(a, b) {
            var ia = ordenRomanos.indexOf(a);
            var ib = ordenRomanos.indexOf(b);
            if (ia === -1) ia = 999;
            if (ib === -1) ib = 999;
            return ia - ib;
        });
        
        if (sortedBloques.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay bloques registrados</p>';
            return;
        }
        
        sortedBloques.forEach(function(bloque) {
            var sectores = bloquesCache[bloque] || [];
            if (!Array.isArray(sectores)) sectores = [];
            var sectoresNombres = sectores.map(function(s) { return s ? safeString(s.sector) : ''; }).filter(Boolean).join(', ');
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
    } catch (e) {
        console.error('Error en cargarBloquesUI:', e);
    }
}

function eliminarBloque(bloque) {
    if (!confirm('⚠️ ¿Eliminar TODO el Bloque ' + bloque + ' y TODOS sus sectores?')) return;
    ejecutarConLoading(function() {
        var sectores = bloquesCache[bloque] || [];
        var updates = {};
        sectores.forEach(function(s) {
            if (s && s.key) updates[s.key] = null;
        });
        if (usandoFirebase && db) {
            db.ref('bloques').update(updates)
                .then(function() { 
                    showNotification('✅ Bloque eliminado correctamente', 'success');
                })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        } else {
            showNotification('❌ Sin conexión', 'error');
        }
    }, 'Eliminando bloque...');
}

function cargarSectoresUI() {
    var select = document.getElementById('calleSectorSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar</option>';
    Object.keys(bloquesCache).forEach(function(bloque) {
        var sectores = bloquesCache[bloque] || [];
        if (!Array.isArray(sectores)) return;
        sectores.forEach(function(s) {
            if (!s) return;
            var option = document.createElement('option');
            option.value = safeString(s.sector);
            option.textContent = safeString(s.sector) + ' (Bloque ' + bloque + ')';
            option.dataset.bloque = bloque;
            option.dataset.key = safeString(s.key);
            select.appendChild(option);
        });
    });
    cargarSectoresEnAsignacion();
}

document.getElementById('bloqueForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var bloque = document.getElementById('bloqueSelect').value;
    var sector = document.getElementById('sectorNombre').value.trim();
    
    if (!bloque || !sector) {
        showNotification('⚠️ Seleccione un bloque y escriba un sector', 'warning');
        return;
    }
    
    var sectores = bloquesCache[bloque] || [];
    var existe = sectores.some(function(s) { return s && s.sector === sector; });
    if (existe) {
        showNotification('⚠️ Este sector ya existe en el bloque', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        var key = bloque + '_' + sector.replace(/\s/g, '_');
        var data = { bloque: bloque, sector: sector };
        
        if (usandoFirebase && db) {
            db.ref('bloques/' + key).set(data)
                .then(function() {
                    document.getElementById('sectorNombre').value = '';
                    document.getElementById('bloqueSelect').value = '';
                    showNotification('✅ Bloque y sector guardados', 'success');
                })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        } else {
            showNotification('❌ Sin conexión a Firebase', 'error');
        }
    }, 'Guardando bloque y sector...');
});

// ============================================================
// CALLES
// ============================================================
function cargarCallesUI() {
    var container = document.getElementById('calleList');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var calles = Object.values(callesCache).filter(function(c) {
            return c && typeof c === 'object';
        });
        
        if (calles.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay calles registradas</p>';
            return;
        }
        
        calles.sort(function(a, b) {
            var ba = safeString(a && a.bloque);
            var bb = safeString(b && b.bloque);
            var cmp = ba.localeCompare(bb);
            if (cmp !== 0) return cmp;
            var sa = safeString(a && a.sector);
            var sb = safeString(b && b.sector);
            cmp = sa.localeCompare(sb);
            if (cmp !== 0) return cmp;
            return safeString(a && a.nombre).localeCompare(safeString(b && b.nombre));
        });
        
        calles.forEach(function(calle) {
            if (!calle) return;
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">📍 ${safeString(calle.nombre) || 'Sin nombre'}</span>
                    <span class="detail">Bloque ${safeString(calle.bloque) || 'N/A'} - ${safeString(calle.sector) || 'N/A'}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-delete" onclick="eliminarCalle('${safeString(calle.key)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Error en cargarCallesUI:', e);
    }
}

document.getElementById('calleForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var bloque = document.getElementById('calleBloqueSelect').value;
    var sector = document.getElementById('calleSectorSelect').value;
    var nombre = document.getElementById('calleNombre').value.trim();
    
    if (!bloque || !sector || !nombre) {
        showNotification('⚠️ Complete todos los campos', 'warning');
        return;
    }
    
    var existe = Object.values(callesCache).some(function(c) {
        return c && c.bloque === bloque && c.sector === sector && c.nombre === nombre;
    });
    if (existe) {
        showNotification('⚠️ Esta calle ya existe', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        var key = bloque + '_' + sector + '_' + nombre.replace(/\s/g, '_');
        var data = { bloque: bloque, sector: sector, nombre: nombre };
        
        if (usandoFirebase && db) {
            db.ref('calles/' + key).set(data)
                .then(function() {
                    document.getElementById('calleNombre').value = '';
                    showNotification('✅ Calle guardada', 'success');
                })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        } else {
            showNotification('❌ Sin conexión', 'error');
        }
    }, 'Guardando calle...');
});

function eliminarCalle(key) {
    if (!confirm('⚠️ ¿Eliminar esta calle?')) return;
    ejecutarConLoading(function() {
        if (usandoFirebase && db) {
            db.ref('calles/' + key).remove()
                .then(function() { showNotification('✅ Calle eliminada', 'success'); })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        }
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
        var ia = ordenRomanos.indexOf(a);
        var ib = ordenRomanos.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
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
        var sectores = bloquesCache[bloque] || [];
        if (!Array.isArray(sectores)) sectores = [];
        sectores.forEach(function(s) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = safeString(s.sector);
            opt.textContent = safeString(s.sector);
            selectSector.appendChild(opt);
        });
    }
}

// ============================================================
// ENCUESTADORES
// ============================================================
function cargarEncuestadoresUI() {
    var container = document.getElementById('encuestadorList');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var keys = Object.keys(encuestadoresCache);
        
        if (keys.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay encuestadores registrados</p>';
            return;
        }
        
        keys.forEach(function(key) {
            var data = encuestadoresCache[key];
            if (!data) return;
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">👤 ${safeString(data.nombre)}</span>
                    <span class="detail">Usuario: ${safeString(data.usuario)} | Sector: ${safeString(data.sector) || 'Sin asignar'}</span>
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
    } catch (e) {
        console.error('Error en cargarEncuestadoresUI:', e);
    }
}

document.getElementById('usuarioForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var nombre = document.getElementById('encuestadorNombre').value.trim();
    var usuario = document.getElementById('encuestadorUser').value.trim();
    var contraseña = document.getElementById('encuestadorPass').value.trim();
    var sector = document.getElementById('encuestadorSectorAsignado').value;
    
    if (!nombre || !usuario || !contraseña || !sector) {
        showNotification('⚠️ Complete todos los campos', 'warning');
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
        
        if (usandoFirebase && db) {
            db.ref('encuestadores/' + key).set(data)
                .then(function() {
                    document.getElementById('encuestadorNombre').value = '';
                    document.getElementById('encuestadorUser').value = '';
                    document.getElementById('encuestadorPass').value = '';
                    document.getElementById('encuestadorSectorAsignado').value = '';
                    showNotification('✅ Encuestador registrado', 'success');
                })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        } else {
            showNotification('❌ Sin conexión', 'error');
        }
    }, 'Registrando encuestador...');
});

function eliminarEncuestador(key) {
    if (!confirm('⚠️ ¿Eliminar este encuestador?')) return;
    ejecutarConLoading(function() {
        if (usandoFirebase && db) {
            db.ref('encuestadores/' + key).remove()
                .then(function() { showNotification('✅ Encuestador eliminado', 'success'); })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        }
    }, 'Eliminando encuestador...');
}

function editarEncuestador(key) {
    var data = encuestadoresCache[key];
    if (!data) {
        showNotification('❌ No se encontraron datos', 'error');
        return;
    }
    
    var opciones = 'Seleccione el sector:\n';
    var sectores = [];
    Object.keys(bloquesCache).forEach(function(bloque) {
        var sectoresBloque = bloquesCache[bloque] || [];
        if (!Array.isArray(sectoresBloque)) return;
        sectoresBloque.forEach(function(s) {
            if (!s) return;
            var texto = bloque + ' - ' + safeString(s.sector);
            sectores.push(texto);
            opciones += sectores.length + '. ' + texto + '\n';
        });
    });
    
    if (sectores.length === 0) {
        showNotification('⚠️ No hay sectores disponibles', 'warning');
        return;
    }
    
    opciones += '\nIngrese el número (1-' + sectores.length + '):';
    var seleccion = prompt(opciones, '');
    if (seleccion === null) return;
    
    var idx = parseInt(seleccion) - 1;
    if (isNaN(idx) || idx < 0 || idx >= sectores.length) {
        showNotification('❌ Selección inválida', 'error');
        return;
    }
    
    var sectorSeleccionado = sectores[idx];
    var sectorNombre = sectorSeleccionado.split(' - ')[1];
    
    if (!confirm('¿Asignar "' + sectorNombre + '" a "' + data.nombre + '"?')) return;
    
    ejecutarConLoading(function() {
        if (usandoFirebase && db) {
            db.ref('encuestadores/' + key).update({ sector: sectorNombre })
                .then(function() {
                    showNotification('✅ Sector asignado', 'success');
                })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        }
    }, 'Asignando sector...');
}

function cargarSelectorEncuestadores() {
    var select = document.getElementById('censoEncuestador');
    if (!select) return;
    
    if (currentUser && currentUser.role === 'encuestador') {
        select.innerHTML = `<option value="${safeString(currentUser.name)}">${safeString(currentUser.name)}</option>`;
        select.value = currentUser.name;
        select.disabled = true;
        return;
    }
    
    select.innerHTML = '<option value="">Seleccionar Encuestador</option>';
    Object.values(encuestadoresCache).forEach(function(data) {
        if (!data) return;
        var opt = document.createElement('option');
        opt.value = safeString(data.nombre);
        opt.textContent = safeString(data.nombre);
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
        var ia = ordenRomanos.indexOf(a);
        var ib = ordenRomanos.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
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
        var sectores = bloquesCache[bloque] || [];
        if (!Array.isArray(sectores)) sectores = [];
        sectores.forEach(function(s) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = safeString(s.sector);
            opt.textContent = safeString(s.sector);
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
        showNotification('⚠️ Complete todos los campos', 'warning');
        return;
    }
    
    var existe = Object.values(presidentesCache).some(function(p) {
        return p && p.bloque === bloque && p.sector === sector;
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
        
        if (usandoFirebase && db) {
            db.ref('presidentes/' + key).set(data)
                .then(function() {
                    document.getElementById('presidenteNombre').value = '';
                    document.getElementById('presidenteCedula').value = '';
                    document.getElementById('presidenteBloque').value = '';
                    document.getElementById('presidenteSector').innerHTML = '<option value="">Seleccionar</option>';
                    showNotification('✅ Presidente registrado', 'success');
                })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        } else {
            showNotification('❌ Sin conexión', 'error');
        }
    }, 'Registrando presidente...');
});

function cargarPresidentesUI() {
    var container = document.getElementById('presidenteList');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var keys = Object.keys(presidentesCache);
        
        if (keys.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay presidentes registrados</p>';
            return;
        }
        
        keys.forEach(function(key) {
            var data = presidentesCache[key];
            if (!data) return;
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">👔 ${safeString(data.nombre)}</span>
                    <span class="detail">Bloque ${safeString(data.bloque)} - ${safeString(data.sector)} | Cédula: ${safeString(data.cedula) || 'N/A'}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-delete" onclick="eliminarPresidente('${key}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Error en cargarPresidentesUI:', e);
    }
}

function eliminarPresidente(key) {
    if (!confirm('⚠️ ¿Eliminar este presidente?')) return;
    ejecutarConLoading(function() {
        if (usandoFirebase && db) {
            db.ref('presidentes/' + key).remove()
                .then(function() { showNotification('✅ Presidente eliminado', 'success'); })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        }
    }, 'Eliminando presidente...');
}

function getPresidentePorSector(bloque, sector) {
    var presidentes = Object.values(presidentesCache);
    for (var i = 0; i < presidentes.length; i++) {
        if (presidentes[i] && presidentes[i].bloque === bloque && presidentes[i].sector === sector) {
            return presidentes[i];
        }
    }
    return null;
}

// ============================================================
// CENSO (Encuestas)
// ============================================================
document.getElementById('censusFormData').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!usandoFirebase || !db) {
        showNotification('❌ Sin conexión a Firebase. No se puede guardar.', 'error');
        return;
    }
    
    var tipoDocumento = document.getElementById('tipoDocumento').value;
    var cedula = document.getElementById('cedula').value.trim();
    var nombre = document.getElementById('nombreCompleto').value.trim();
    var nacionalidad = document.getElementById('nacionalidad').value;
    var sexo = document.getElementById('sexo').value;
    var direccion = document.getElementById('direccion').value.trim();
    var telefono = document.getElementById('telefono').value.trim();
    var bloque = document.getElementById('censoBloque').value;
    var sector = document.getElementById('censoSector').value;
    var calle = document.getElementById('censoCalle').value;
    var encuestador = (currentUser && currentUser.name) || document.getElementById('censoEncuestador').value || 'Desconocido';
    
    if (!tipoDocumento) { showNotification('⚠️ Seleccione el tipo de documento', 'warning'); return; }
    if (!cedula) { showNotification('⚠️ Ingrese el número de documento', 'warning'); return; }
    if (!nombre) { showNotification('⚠️ Ingrese el nombre completo', 'warning'); return; }
    if (!nacionalidad) { showNotification('⚠️ Seleccione la nacionalidad', 'warning'); return; }
    if (!sexo) { showNotification('⚠️ Seleccione el sexo', 'warning'); return; }
    if (!direccion) { showNotification('⚠️ Ingrese la dirección', 'warning'); return; }
    if (!bloque) { showNotification('⚠️ Seleccione el bloque', 'warning'); return; }
    if (!sector) { showNotification('⚠️ Seleccione el sector', 'warning'); return; }
    if (!calle) { showNotification('⚠️ Seleccione la calle', 'warning'); return; }
    
    var existe = Object.values(censoCache).some(function(d) { return d && d.cedula === cedula && !window.editKey; });
    if (existe) {
        showNotification('⚠️ Esta cédula ya está registrada.', 'warning');
        return;
    }
    
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        if (sector !== currentUser.sector) {
            showNotification('⚠️ Solo puede encuestar en el sector asignado', 'warning');
            return;
        }
    }
    
    const fileInput = document.getElementById('fotoCedula');
    let fotoUrl = null;
    
    if (fileInput.files && fileInput.files.length > 0) {
        try {
            showLoading('Subiendo foto a Cloudinary...');
            fotoUrl = await subirImagenCloudinary(fileInput.files[0]);
            hideLoading();
            showNotification('✅ Foto subida', 'success', 2000);
        } catch (error) {
            hideLoading();
            showNotification('❌ Error al subir la foto: ' + error.message, 'error');
            return;
        }
    }
    
    var numeroSecuencia = asignarNumeroSecuencia(sector);
    
    var data = {
        numeroSecuencia: numeroSecuencia,
        tipoDocumento: tipoDocumento,
        cedula: cedula,
        nombre: nombre.toUpperCase(),
        nacionalidad: nacionalidad,
        sexo: sexo,
        telefono: telefono,
        direccion: direccion.toUpperCase(),
        bloque: bloque,
        sector: sector,
        calle: calle.toUpperCase(),
        encuestador: encuestador,
        fotoUrl: fotoUrl,
        fecha: new Date().toISOString(),
        fechaRegistro: new Date().toLocaleString(),
        registradoPor: (currentUser && currentUser.name) || 'Desconocido'
    };
    
    ejecutarConLoading(function() {
        var key = 'censo_' + Date.now();
        
        db.ref('censo/' + key).set(data)
            .then(function() {
                document.getElementById('censusFormData').reset();
                document.getElementById('censoBloque').value = '';
                document.getElementById('censoSector').innerHTML = '<option value="">Seleccionar Sector</option>';
                document.getElementById('censoCalle').innerHTML = '<option value="">Seleccionar Calle</option>';
                document.getElementById('censoEncuestador').value = encuestador;
                document.getElementById('previewFoto').style.display = 'none';
                document.getElementById('nacionalidad').value = '';
                document.getElementById('nacionalidad').disabled = false;
                document.getElementById('tipoDocumento').value = '';
                if (currentUser && currentUser.role === 'encuestador') {
                    document.getElementById('censoEncuestador').value = currentUser.name;
                    document.getElementById('censoEncuestador').disabled = true;
                }
                showNotification('✅ Encuesta guardada - Sector ' + sector + ' N° ' + numeroSecuencia, 'success');
                window.editKey = null;
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Guardando encuesta...');
});

// ============================================================
// MOSTRAR FOTO
// ============================================================
function mostrarFotoPersona(item) {
    if (item && item.fotoUrl) {
        return `<img src="${item.fotoUrl}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;margin-right:10px;">`;
    } else {
        return `<i class="fas fa-user-circle" style="font-size:28px;color:#999;margin-right:10px;"></i>`;
    }
}

function cargarUltimasEncuestas() {
    var container = document.getElementById('ultimasEncuestas');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var items = Object.values(censoCache).filter(function(d) { return d && typeof d === 'object'; });
        
        if (currentUser && currentUser.role !== 'admin' && currentUser.name) {
            items = items.filter(function(d) { return normalizar(d.encuestador) === normalizar(currentUser.name); });
        }
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay encuestas registradas</p>';
            return;
        }
        
        items.sort(function(a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
        var ultimas = items.slice(0, 10);
        
        ultimas.forEach(function(item) {
            var fotoHtml = mostrarFotoPersona(item);
            var tipoDoc = item.tipoDocumento ? safeString(item.tipoDocumento).toUpperCase() : 'CÉDULA';
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">${fotoHtml} ${safeString(item.nombre)}</span>
                    <span class="detail">📋 ${tipoDoc}: ${safeString(item.cedula)} | ${safeString(item.sector)}, Bloque ${safeString(item.bloque)}</span>
                    <span class="detail">🌍 ${safeString(item.nacionalidad) || 'N/A'} | 📞 ${safeString(item.telefono) || 'N/A'}</span>
                    <span class="detail">🔢 N° Cuadernillo: ${item.numeroSecuencia || 0}</span>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Error en cargarUltimasEncuestas:', e);
    }
}

// ============================================================
// MIS ENCUESTAS
// ============================================================
function cargarMisEncuestas() {
    if (!currentUser || !currentUser.name) return;
    var container = document.getElementById('listaMisEncuestas');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var items = Object.values(censoCache).filter(function(d) {
            return d && normalizar(d.encuestador) === normalizar(currentUser.name);
        });
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No has realizado encuestas</p>';
            return;
        }
        
        items.sort(function(a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
        
        items.forEach(function(item) {
            var key = Object.keys(censoCache).find(function(k) { return censoCache[k] === item; });
            var fotoHtml = mostrarFotoPersona(item);
            var tipoDoc = item.tipoDocumento ? safeString(item.tipoDocumento).toUpperCase() : 'CÉDULA';
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">${fotoHtml} ${safeString(item.nombre)}</span>
                    <span class="detail">📋 ${tipoDoc}: ${safeString(item.cedula)} | ${safeString(item.sector)}, Bloque ${safeString(item.bloque)}</span>
                    <span class="detail">📍 ${safeString(item.direccion)} | 📞 ${safeString(item.telefono) || 'N/A'}</span>
                    <span class="detail">📅 ${safeString(item.fechaRegistro)}</span>
                    <span class="detail">🔢 N° Cuadernillo: ${item.numeroSecuencia || 0}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-delete" onclick="eliminarMiEncuesta('${key}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Error en cargarMisEncuestas:', e);
    }
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
    
    try {
        var items = Object.values(censoCache).filter(function(d) {
            if (!d) return false;
            if (normalizar(d.encuestador) !== normalizar(currentUser.name)) return false;
            var matchCedula = !cedula || safeString(d.cedula).toLowerCase().indexOf(cedula) !== -1;
            var matchNombre = !nombre || safeString(d.nombre).toLowerCase().indexOf(nombre) !== -1;
            return matchCedula && matchNombre;
        });
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No se encontraron encuestas</p>';
            return;
        }
        
        items.sort(function(a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
        
        items.forEach(function(item) {
            var key = Object.keys(censoCache).find(function(k) { return censoCache[k] === item; });
            var fotoHtml = mostrarFotoPersona(item);
            var tipoDoc = item.tipoDocumento ? safeString(item.tipoDocumento).toUpperCase() : 'CÉDULA';
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">${fotoHtml} ${safeString(item.nombre)}</span>
                    <span class="detail">📋 ${tipoDoc}: ${safeString(item.cedula)} | ${safeString(item.sector)}</span>
                    <span class="detail">📍 ${safeString(item.direccion)} | 📞 ${safeString(item.telefono) || 'N/A'}</span>
                    <span class="detail">📅 ${safeString(item.fechaRegistro)}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-delete" onclick="eliminarMiEncuesta('${key}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Error en buscarMisEncuestas:', e);
    }
}

function eliminarMiEncuesta(key) {
    if (!confirm('⚠️ ¿Eliminar esta encuesta?')) return;
    ejecutarConLoading(function() {
        if (usandoFirebase && db) {
            db.ref('censo/' + key).remove()
                .then(function() { showNotification('✅ Encuesta eliminada', 'success'); })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        }
    }, 'Eliminando encuesta...');
}

// ============================================================
// ADMIN: ENCUESTAS
// ============================================================
function cargarTodasEncuestas() {
    var el1 = document.getElementById('buscarCedula');
    var el2 = document.getElementById('buscarNombre');
    if (el1) el1.value = '';
    if (el2) el2.value = '';
    cargarEncuestasFiltradas();
}

function buscarEncuestas() {
    cargarEncuestasFiltradas();
}

function cargarEncuestasFiltradas() {
    var cedulaEl = document.getElementById('buscarCedula');
    var nombreEl = document.getElementById('buscarNombre');
    var cedula = cedulaEl ? cedulaEl.value.trim().toLowerCase() : '';
    var nombre = nombreEl ? nombreEl.value.trim().toLowerCase() : '';
    var container = document.getElementById('listaEncuestasAdmin');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var items = Object.values(censoCache).filter(function(d) { return d && typeof d === 'object'; });
        
        if (cedula || nombre) {
            items = items.filter(function(d) {
                var matchCedula = !cedula || safeString(d.cedula).toLowerCase().indexOf(cedula) !== -1;
                var matchNombre = !nombre || safeString(d.nombre).toLowerCase().indexOf(nombre) !== -1;
                return matchCedula && matchNombre;
            });
        }
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No se encontraron encuestas</p>';
            return;
        }
        
        items.sort(function(a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
        
        items.forEach(function(item) {
            var key = Object.keys(censoCache).find(function(k) { return censoCache[k] === item; });
            var fotoHtml = mostrarFotoPersona(item);
            var tipoDoc = item.tipoDocumento ? safeString(item.tipoDocumento).toUpperCase() : 'CÉDULA';
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">${fotoHtml} ${safeString(item.nombre)}</span>
                    <span class="detail">📋 ${tipoDoc}: ${safeString(item.cedula)} | ${safeString(item.sector)}, Bloque ${safeString(item.bloque)}</span>
                    <span class="detail">📍 ${safeString(item.direccion)} | 📞 ${safeString(item.telefono) || 'N/A'}</span>
                    <span class="detail">👤 Encuestador: ${safeString(item.encuestador)} | 📅 ${safeString(item.fechaRegistro)}</span>
                    <span class="detail">🔢 N° Cuadernillo: ${item.numeroSecuencia || 0}</span>
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
    } catch (e) {
        console.error('Error en cargarEncuestasFiltradas:', e);
    }
}

function eliminarEncuesta(key) {
    if (!confirm('⚠️ ¿Eliminar esta encuesta?')) return;
    ejecutarConLoading(function() {
        if (usandoFirebase && db) {
            db.ref('censo/' + key).remove()
                .then(function() { showNotification('✅ Encuesta eliminada', 'success'); })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        }
    }, 'Eliminando encuesta...');
}

function editarEncuesta(key) {
    var data = censoCache[key];
    if (!data) {
        showNotification('❌ No se encontraron datos', 'error');
        return;
    }
    
    document.getElementById('tipoDocumento').value = data.tipoDocumento || '';
    document.getElementById('cedula').value = data.cedula || '';
    document.getElementById('nombreCompleto').value = data.nombre || '';
    document.getElementById('nacionalidad').value = data.nacionalidad || '';
    document.getElementById('sexo').value = data.sexo || '';
    document.getElementById('telefono').value = data.telefono || '';
    document.getElementById('direccion').value = data.direccion || '';
    document.getElementById('censoBloque').value = data.bloque || '';
    document.getElementById('censoEncuestador').value = data.encuestador || (currentUser && currentUser.name) || '';
    
    if (data.fotoUrl) {
        document.getElementById('previewImg').src = data.fotoUrl;
        document.getElementById('previewFoto').style.display = 'block';
    }
    
    if (data.tipoDocumento === 'cedula') {
        document.getElementById('nacionalidad').value = 'dominicana';
        document.getElementById('nacionalidad').disabled = true;
    } else {
        document.getElementById('nacionalidad').disabled = false;
    }
    
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
    showNotification('📝 Editando encuesta', 'info', 4000);
}

function actualizarEncuesta(key) {
    if (!usandoFirebase || !db) {
        showNotification('❌ Sin conexión', 'error');
        return;
    }
    
    var dataOriginal = censoCache[key];
    var cedula = document.getElementById('cedula').value.trim();
    
    var duplicado = Object.values(censoCache).some(function(d) {
        return d && d.cedula === cedula && Object.keys(censoCache).find(function(k) { return censoCache[k] === d; }) !== key;
    });
    if (duplicado) {
        showNotification('⚠️ Esta cédula ya está registrada.', 'warning');
        return;
    }
    
    var data = {
        numeroSecuencia: (dataOriginal && dataOriginal.numeroSecuencia) || 0,
        tipoDocumento: document.getElementById('tipoDocumento').value,
        cedula: cedula,
        nombre: document.getElementById('nombreCompleto').value.trim().toUpperCase(),
        nacionalidad: document.getElementById('nacionalidad').value,
        sexo: document.getElementById('sexo').value,
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim().toUpperCase(),
        bloque: document.getElementById('censoBloque').value,
        sector: document.getElementById('censoSector').value,
        calle: document.getElementById('censoCalle').value.toUpperCase(),
        encuestador: document.getElementById('censoEncuestador').value || (currentUser && currentUser.name) || 'Desconocido',
        fotoUrl: (dataOriginal && dataOriginal.fotoUrl) || null,
        fecha: new Date().toISOString(),
        fechaRegistro: new Date().toLocaleString(),
        registradoPor: (currentUser && currentUser.name) || 'Desconocido',
        editado: true,
        editadoPor: (currentUser && currentUser.name) || 'Admin',
        fechaEdicion: new Date().toLocaleString()
    };
    
    if (!data.tipoDocumento || !data.cedula || !data.nombre || !data.nacionalidad || !data.sexo || 
        !data.direccion || !data.bloque || !data.sector || !data.calle) {
        showNotification('⚠️ Complete todos los campos obligatorios', 'warning');
        return;
    }
    
    ejecutarConLoading(function() {
        db.ref('censo/' + key).update(data)
            .then(function() {
                resetFormularioEncuesta();
                showNotification('✅ Encuesta actualizada', 'success');
                window.editKey = null;
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Actualizando encuesta...');
}

function resetFormularioEncuesta() {
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
    document.getElementById('previewFoto').style.display = 'none';
    document.getElementById('nacionalidad').value = '';
    document.getElementById('nacionalidad').disabled = false;
    document.getElementById('tipoDocumento').value = '';
    if (currentUser && currentUser.role === 'encuestador') {
        document.getElementById('censoEncuestador').value = currentUser.name;
        document.getElementById('censoEncuestador').disabled = true;
    }
}

// ============================================================
// VOTACIÓN
// ============================================================
function cargarBloquesVotacion() {
    var selectBloque = document.getElementById('votacionBloque');
    if (!selectBloque) return;
    
    var ordenRomanos = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    var bloques = Object.keys(bloquesCache).sort(function(a, b) {
        var ia = ordenRomanos.indexOf(a);
        var ib = ordenRomanos.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
    });
    
    selectBloque.innerHTML = '<option value="">Seleccionar</option>';
    bloques.forEach(function(bloque) {
        var opt = document.createElement('option');
        opt.value = bloque;
        opt.textContent = 'Bloque ' + bloque;
        selectBloque.appendChild(opt);
    });
    
    selectBloque.onchange = function() {
        cargarSectoresVotacion(this.value);
    };
}

function cargarSectoresVotacion(bloque) {
    var selectSector = document.getElementById('votacionSector');
    if (!selectSector) return;
    
    selectSector.innerHTML = '<option value="">Seleccionar</option>';
    if (bloque && bloquesCache[bloque]) {
        var sectores = bloquesCache[bloque] || [];
        if (!Array.isArray(sectores)) sectores = [];
        sectores.forEach(function(s) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = safeString(s.sector);
            opt.textContent = safeString(s.sector);
            selectSector.appendChild(opt);
        });
    }
}

function iniciarEleccion() {
    var fecha = document.getElementById('fechaEleccion').value;
    var bloque = document.getElementById('votacionBloque').value;
    var sector = document.getElementById('votacionSector').value;
    
    if (!fecha || !bloque || !sector) {
        showNotification('⚠️ Complete todos los campos', 'warning');
        return;
    }
    
    eleccionActiva = true;
    window.eleccionData = {
        fecha: fecha,
        bloque: bloque,
        sector: sector
    };
    showNotification('✅ Jornada iniciada: ' + sector, 'success');
}

function buscarParaVotar() {
    if (!eleccionActiva) {
        showNotification('⚠️ Inicie la jornada electoral', 'warning');
        return;
    }
    
    var busqueda = document.getElementById('votacionBusqueda').value.trim();
    
    if (!busqueda) {
        showNotification('⚠️ Ingrese un término de búsqueda', 'warning');
        return;
    }
    
    var busquedaLower = busqueda.toLowerCase();
    var persona = null;
    var personaKey = null;
    var tipoBusqueda = '';
    
    var esNumero = /^\d+$/.test(busqueda);
    
    Object.keys(censoCache).forEach(function(key) {
        var d = censoCache[key];
        if (!d) return;
        var match = false;
        
        if (esNumero && d.numeroSecuencia && parseInt(d.numeroSecuencia) === parseInt(busqueda)) {
            match = true;
            tipoBusqueda = 'N° Cuadernillo';
        }
        
        if (!match && d.cedula) {
            var cedulaLimpia = limpiarCedula(d.cedula);
            var busquedaLimpia = limpiarCedula(busqueda);
            if (cedulaLimpia === busquedaLimpia) {
                match = true;
                tipoBusqueda = 'Cédula';
            }
        }
        
        if (!match && d.nombre && safeString(d.nombre).toLowerCase().indexOf(busquedaLower) !== -1) {
            match = true;
            tipoBusqueda = 'Nombre';
        }
        
        if (match) {
            persona = d;
            personaKey = key;
        }
    });
    
    if (!persona) {
        showNotification('❌ No se encontró a esta persona', 'error');
        document.getElementById('votacionResultado').style.display = 'none';
        return;
    }
    
    if (persona.sector !== window.eleccionData.sector) {
        showNotification('⚠️ Pertenece al sector ' + persona.sector, 'warning');
        document.getElementById('votacionResultado').style.display = 'none';
        return;
    }
    
    var yaVoto = Object.values(votantesCache).some(function(v) {
        return v && v.cedula === persona.cedula && v.fecha === window.eleccionData.fecha;
    });
    
    if (yaVoto) {
        showNotification('⚠️ Esta persona YA VOTÓ', 'warning');
        document.getElementById('votacionResultado').style.display = 'none';
        return;
    }
    
    var tipoDoc = persona.tipoDocumento ? safeString(persona.tipoDocumento).toUpperCase() : 'CÉDULA';
    
    document.getElementById('votanteFoto').src = persona.fotoUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23eee%22/%3E%3Ctext x=%2250%22 y=%2250%22 font-size=%2210%22 text-anchor=%22middle%22 dy=%22.3em%22%3ESin Foto%3C/text%3E%3C/svg%3E';
    document.getElementById('votanteNombre').textContent = safeString(persona.nombre) || 'Sin nombre';
    document.getElementById('votanteTipoDoc').textContent = tipoDoc;
    document.getElementById('votanteCedula').textContent = safeString(persona.cedula) || 'N/A';
    document.getElementById('votanteNacionalidad').textContent = safeString(persona.nacionalidad) || 'N/A';
    document.getElementById('votanteDireccion').textContent = safeString(persona.direccion) || 'N/A';
    document.getElementById('votanteTelefono').textContent = safeString(persona.telefono) || 'N/A';
    document.getElementById('votanteSector').textContent = safeString(persona.sector) || 'N/A';
    document.getElementById('votanteBloque').textContent = safeString(persona.bloque) || 'N/A';
    document.getElementById('votanteCalle').textContent = safeString(persona.calle) || 'N/A';
    document.getElementById('votanteNumeroSecuencia').textContent = persona.numeroSecuencia || 'N/A';
    document.getElementById('votanteEstado').textContent = '✅ Habilitado para votar';
    document.getElementById('votanteEstado').style.color = 'var(--success)';
    
    window.personaParaVotar = {
        key: personaKey,
        data: persona
    };
    
    document.getElementById('votacionResultado').style.display = 'block';
    showNotification('✅ Encontrado por ' + tipoBusqueda, 'success', 2000);
}

function registrarVoto() {
    if (!window.personaParaVotar) {
        showNotification('⚠️ No hay persona seleccionada', 'warning');
        return;
    }
    
    if (!eleccionActiva) {
        showNotification('⚠️ La jornada no está activa', 'warning');
        return;
    }
    
    if (!usandoFirebase || !db) {
        showNotification('❌ Sin conexión', 'error');
        return;
    }
    
    var persona = window.personaParaVotar.data;
    var key = 'votante_' + Date.now();
    var data = {
        cedula: persona.cedula,
        nombre: persona.nombre,
        tipoDocumento: persona.tipoDocumento || '',
        nacionalidad: persona.nacionalidad || '',
        direccion: persona.direccion || '',
        telefono: persona.telefono || '',
        sector: persona.sector,
        bloque: persona.bloque,
        calle: persona.calle,
        numeroSecuencia: persona.numeroSecuencia || 0,
        fotoUrl: persona.fotoUrl || null,
        fecha: window.eleccionData.fecha,
        fechaRegistro: new Date().toLocaleString(),
        registradoPor: (currentUser && currentUser.name) || 'Desconocido',
        eleccion: window.eleccionData
    };
    
    ejecutarConLoading(function() {
        db.ref('votantes/' + key).set(data)
            .then(function() {
                showNotification('✅ Voto registrado: ' + persona.nombre, 'success');
                document.getElementById('votacionResultado').style.display = 'none';
                document.getElementById('votacionBusqueda').value = '';
                window.personaParaVotar = null;
                cargarVotantesHoy();
            })
            .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
    }, 'Registrando voto...');
}

function cargarVotantesHoy() {
    var container = document.getElementById('listaVotantesHoy');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var items = Object.values(votantesCache).filter(function(v) { return v && typeof v === 'object'; });
        
        if (eleccionActiva && window.eleccionData) {
            items = items.filter(function(v) { return v.fecha === window.eleccionData.fecha; });
        }
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay votantes en esta jornada</p>';
            return;
        }
        
        items.sort(function(a, b) {
            return safeString(a && a.nombre).localeCompare(safeString(b && b.nombre));
        });
        
        items.forEach(function(item) {
            var fotoHtml = item.fotoUrl ? 
                `<img src="${item.fotoUrl}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;margin-right:8px;">` :
                `<i class="fas fa-user-circle" style="font-size:20px;color:#999;margin-right:8px;"></i>`;
            var tipoDoc = item.tipoDocumento ? safeString(item.tipoDocumento).toUpperCase() : 'CÉDULA';
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">${fotoHtml} ${safeString(item.nombre) || 'Sin nombre'}</span>
                    <span class="detail">📋 ${tipoDoc}: ${safeString(item.cedula) || 'N/A'} | ${safeString(item.sector) || 'N/A'}</span>
                    <span class="detail">🔢 N° ${item.numeroSecuencia || 'N/A'} | ⏰ ${safeString(item.fechaRegistro) || 'N/A'}</span>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Error en cargarVotantesHoy:', e);
    }
}

function cargarVotantesAdmin() {
    var container = document.getElementById('listaVotantesAdmin');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        var items = Object.values(votantesCache).filter(function(v) { return v && typeof v === 'object'; });
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color:var(--gray-dark);padding:10px;">No hay votantes registrados</p>';
            return;
        }
        
        items.sort(function(a, b) {
            var fechaA = a && a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
            var fechaB = b && b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
            return fechaB - fechaA;
        });
        
        items.forEach(function(item) {
            var key = Object.keys(votantesCache).find(function(k) { return votantesCache[k] === item; });
            var fotoHtml = item.fotoUrl ? 
                `<img src="${item.fotoUrl}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;margin-right:8px;">` :
                `<i class="fas fa-user-circle" style="font-size:20px;color:#999;margin-right:8px;"></i>`;
            var tipoDoc = item.tipoDocumento ? safeString(item.tipoDocumento).toUpperCase() : 'CÉDULA';
            var div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="item-info">
                    <span class="name">${fotoHtml} ${safeString(item.nombre) || 'Sin nombre'}</span>
                    <span class="detail">📋 ${tipoDoc}: ${safeString(item.cedula) || 'N/A'} | ${safeString(item.sector) || 'N/A'} | Bloque ${safeString(item.bloque) || 'N/A'}</span>
                    <span class="detail">📅 Elección: ${safeString(item.fecha) || 'N/A'} | Registrado: ${safeString(item.fechaRegistro) || 'N/A'}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-delete" onclick="eliminarVotante('${key}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Error en cargarVotantesAdmin:', e);
    }
}

function eliminarVotante(key) {
    if (!confirm('⚠️ ¿Eliminar este votante?')) return;
    ejecutarConLoading(function() {
        if (usandoFirebase && db) {
            db.ref('votantes/' + key).remove()
                .then(function() { showNotification('✅ Votante eliminado', 'success'); })
                .catch(function(error) { showNotification('❌ Error: ' + error.message, 'error'); });
        }
    }, 'Eliminando votante...');
}

// ============================================================
// ESTADÍSTICAS
// ============================================================
function actualizarEstadisticas() {
    try {
        var totalCensados = Object.keys(censoCache).length;
        var totalMisCensados = 0;
        var totalVotantes = Object.keys(votantesCache).length;
        var totalBloques = Object.keys(bloquesCache).length;
        
        if (currentUser && currentUser.role !== 'admin' && currentUser.name) {
            var misItems = Object.values(censoCache).filter(function(d) {
                return d && normalizar(d.encuestador) === normalizar(currentUser.name);
            });
            totalMisCensados = misItems.length;
            if (currentUser.sector) {
                var itemsSector = Object.values(censoCache).filter(function(d) { return d && d.sector === currentUser.sector; });
                totalCensados = itemsSector.length;
            } else {
                totalCensados = misItems.length;
            }
            totalVotantes = 0;
            totalBloques = 0;
        }
        
        var elTotalCensados = document.getElementById('totalCensados');
        var elTotalMis = document.getElementById('totalMisCensados');
        var elTotalVotantes = document.getElementById('totalVotantes');
        var elTotalBloques = document.getElementById('totalBloques');
        
        if (elTotalCensados) elTotalCensados.textContent = totalCensados;
        if (elTotalMis) elTotalMis.textContent = totalMisCensados;
        if (elTotalVotantes) elTotalVotantes.textContent = totalVotantes;
        if (elTotalBloques) elTotalBloques.textContent = totalBloques;
    } catch (e) {
        console.error('Error en actualizarEstadisticas:', e);
    }
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
        var ia = ordenRomanos.indexOf(a);
        var ib = ordenRomanos.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
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
        if (!Array.isArray(sectores)) return;
        sectores.forEach(function(s) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = safeString(s.sector);
            opt.textContent = safeString(s.sector);
            selectSector.appendChild(opt);
        });
    });
}

document.getElementById('reportBloque').addEventListener('change', function() {
    var bloque = this.value;
    var sectorSelect = document.getElementById('reportSector');
    sectorSelect.innerHTML = '<option value="">Seleccionar</option>';
    if (bloque && bloquesCache[bloque]) {
        var sectores = bloquesCache[bloque] || [];
        if (!Array.isArray(sectores)) sectores = [];
        sectores.forEach(function(s) {
            if (!s) return;
            var opt = document.createElement('option');
            opt.value = safeString(s.sector);
            opt.textContent = safeString(s.sector);
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

// ============================================================
// GENERAR CUADERNILLO PDF
// ============================================================
function generarCuadernillo(conMarcaDeAgua) {
    var columnas = getColumnasSeleccionadas();
    if (columnas.length === 0) {
        showNotification('⚠️ Seleccione al menos una columna', 'warning');
        return;
    }
    
    var datos = Object.values(censoCache).filter(function(d) { return d && typeof d === 'object'; });
    var titulo = 'Todos los Sectores';
    
    if (currentUser && currentUser.role !== 'admin' && currentUser.sector) {
        datos = datos.filter(function(d) { return d.sector === currentUser.sector; });
        titulo = 'Sector: ' + currentUser.sector;
    } else {
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
        
        var fechaDesde = document.getElementById('reportFechaDesde').value;
        var fechaHasta = document.getElementById('reportFechaHasta').value;
        if (fechaDesde) {
            var desde = new Date(fechaDesde).getTime();
            datos = datos.filter(function(d) { return new Date(d.fecha || 0).getTime() >= desde; });
        }
        if (fechaHasta) {
            var hasta = new Date(fechaHasta).getTime() + 86400000;
            datos = datos.filter(function(d) { return new Date(d.fecha || 0).getTime() <= hasta; });
        }
        
        var orderBy = document.getElementById('reportOrderBy').value;
        var orderDir = document.getElementById('reportOrderDir').value;
        datos.sort(function(a, b) {
            var valA = safeString(a && a[orderBy]);
            var valB = safeString(b && b[orderBy]);
            if (orderBy === 'fecha') {
                valA = new Date(a.fecha || 0).getTime();
                valB = new Date(b.fecha || 0).getTime();
                return orderDir === 'asc' ? valA - valB : valB - valA;
            }
            var cmp = valA.localeCompare(valB);
            return orderDir === 'asc' ? cmp : -cmp;
        });
    }
    
    if (datos.length === 0) {
        showNotification('⚠️ No hay datos para el reporte', 'warning');
        return;
    }
    
    marcaDeAguaActiva = conMarcaDeAgua;
    mostrarVistaPreviaCuadernillo(datos, titulo, columnas);
    exportarCuadernilloPDF(datos, titulo, columnas, conMarcaDeAgua);
}

function mostrarVistaPreviaCuadernillo(datos, titulo, columnas) {
    var container = document.getElementById('reportPreview');
    if (!container) return;
    
    var headersMap = {
        no: 'No.', tipoDocumento: 'Tipo Doc.', cedula: 'Cédula', nombre: 'Nombre',
        nacionalidad: 'Nacionalidad', sexo: 'Sexo', telefono: 'Teléfono',
        direccion: 'Dirección', sector: 'Sector', bloque: 'Bloque', calle: 'Calle',
        foto: '📸 Foto', firma: 'FIRMA'
    };
    
    var html = `
        <div class="preview-container">
            <div class="preview-header">
                <h3 style="font-size:1.1rem;">JUNTA MUNICIPAL SAN LUIS</h3>
                <div style="font-size:0.75rem;">RNC: 4-30-017809</div>
                <div style="font-size:0.75rem;">MUNICIPIO: SANTO DOMINGO ESTE - PROVINCIA: SANTO DOMINGO</div>
                <div style="font-size:0.75rem;">DEPARTAMENTO DE ASUNTOS COMUNITARIOS</div>
                <div class="preview-title" style="font-size:0.95rem;font-weight:bold;color:#B8860B;">REPORTE DE CENSO ELECTORAL - CUADERNILLO</div>
                ${marcaDeAguaActiva ? '<div style="color:#B8860B;font-weight:bold;font-size:0.85rem;">🔷 CON MARCA DE AGUA</div>' : ''}
            </div>
            <div class="preview-info" style="font-size:0.8rem;">
                <span><strong>Reporte:</strong> ${titulo}</span>
                <span><strong>Total:</strong> ${datos.length} registros</span>
                <span><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</span>
            </div>
            <div class="preview-table-wrapper">
                <table class="preview-table" style="width:100%;border-collapse:collapse;font-size:0.7rem;">
                    <thead><tr>
                        <th style="width:3%;font-size:0.6rem;">No.</th>
                        <th style="width:12%;font-size:0.6rem;">📸 Foto</th>
    `;
    
    columnas.forEach(function(col) {
        if (col !== 'foto') {
            var ancho = col === 'nombre' ? '14%' : (col === 'direccion' ? '14%' : '9%');
            html += '<th style="width:' + ancho + ';font-size:0.6rem;">' + (headersMap[col] || col) + '</th>';
        }
    });
    
    html += '<th style="width:10%;text-align:center;font-size:0.6rem;">FIRMA</th>';
    html += '</tr></thead><tbody>';
    
    var limit = Math.min(datos.length, 10);
    for (var i = 0; i < limit; i++) {
        var d = datos[i];
        var tipoDoc = d.tipoDocumento ? safeString(d.tipoDocumento).toUpperCase() : 'CÉDULA';
        html += '<tr style="border-bottom:1px solid #eee;">';
        html += '<td style="text-align:center;padding:6px;font-size:0.65rem;">' + (i + 1) + '</td>';
        html += '<td style="text-align:center;padding:6px;">' + (d.fotoUrl ? `<img src="${d.fotoUrl}" style="width:50px;height:50px;border-radius:4px;object-fit:cover;border:1px solid #ccc;">` : '📷') + '</td>';
        columnas.forEach(function(col) {
            if (col !== 'foto') {
                var valor = safeString(d[col]);
                if (col === 'tipoDocumento') {
                    valor = tipoDoc;
                } else if (col !== 'cedula' && col !== 'telefono') {
                    valor = valor.toUpperCase();
                }
                html += '<td style="padding:6px;font-size:0.65rem;">' + valor + '</td>';
            }
        });
        html += '<td style="text-align:center;padding:6px;"><div style="border-bottom:2px solid #333;height:20px;margin:0 auto;width:80%;"></div></td>';
        html += '</tr>';
    }
    
    if (datos.length > 10) {
        html += '<tr><td colspan="' + (columnas.length + 2) + '" style="text-align:center;color:var(--gray-dark);padding:10px;font-size:0.7rem;">';
        html += '... y ' + (datos.length - 10) + ' registros más';
        html += '</td></tr>';
    }
    
    html += `
                </tbody></table>
            </div>
            <div style="display:flex;justify-content:space-around;margin-top:20px;padding-top:15px;border-top:2px solid #B8860B;">
                <div style="text-align:center;">
                    <div style="border-bottom:1px solid #000;height:30px;width:150px;margin:0 auto;"></div>
                    <strong style="font-size:0.85rem;">Francisco Lorenzo</strong>
                    <div style="font-size:0.7rem;color:#6b7a8f;">DIRECTOR</div>
                </div>
                <div style="text-align:center;">
                    <div style="border-bottom:1px solid #000;height:30px;width:150px;margin:0 auto;"></div>
                    <strong style="font-size:0.85rem;">Domingo Carsado</strong>
                    <div style="font-size:0.7rem;color:#6b7a8f;">ENCARGADO</div>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

function exportarCuadernilloPDF(datos, titulo, columnas, conMarcaDeAgua) {
    try {
        if (typeof window.jspdf === 'undefined') {
            showNotification('❌ jspdf no está cargada', 'error');
            return;
        }
        var jsPDF = window.jspdf.jsPDF;
        if (!jsPDF) {
            showNotification('❌ Error al cargar jspdf', 'error');
            return;
        }
        
        var doc = new jsPDF('p', 'mm', 'letter');
        var pageWidth = doc.internal.pageSize.getWidth();
        var pageHeight = doc.internal.pageSize.getHeight();
        var margin = 6;
        var pageNumber = 1;
        
        var columnGap = 2;
        var columnWidth = ((pageWidth - (margin * 2) - columnGap) / 2);
        var leftColumnX = margin;
        var rightColumnX = margin + columnWidth + columnGap;
        var recordHeight = 32;
        var photoWidth = 18;
        var photoHeight = 24;
        var mostrarFoto = columnas.indexOf('foto') !== -1;
        
        function dibujarEncabezado() {
            var logoImg = '';
            try {
                var logoElement = document.querySelector('.nav-logo');
                if (logoElement && logoElement.src) logoImg = logoElement.src;
            } catch (e) {}
            
            if (logoImg) {
                try { doc.addImage(logoImg, 'PNG', margin, 4, 14, 14); } catch (e) {}
            }
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text('JUNTA MUNICIPAL SAN LUIS', margin + 17, 7);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.text('MUNICIPIO SANTO DOMINGO ESTE', margin + 17, 10.5);
            doc.text('RNC: 4-30-017809', margin + 17, 14);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('REPORTE DE CENSO ELECTORAL', pageWidth / 2, 10, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('CUADERNILLO - ' + safeString(titulo).toUpperCase(), pageWidth / 2, 15, { align: 'center' });
            
            if (conMarcaDeAgua) {
                doc.setTextColor(184, 134, 11);
                doc.setFontSize(5);
                doc.text('🔷 DOCUMENTO CON MARCA DE AGUA', pageWidth / 2, 19, { align: 'center' });
                doc.setTextColor(0, 0, 0);
            }
            
            doc.setFontSize(5.5);
            doc.text('TOTAL: ' + datos.length + ' REGISTROS', pageWidth / 2, 23, { align: 'center' });
            
            var pageBoxWidth = 24;
            var pageBoxHeight = 13;
            var pageBoxX = pageWidth - margin - pageBoxWidth;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.rect(pageBoxX, 4, pageBoxWidth, pageBoxHeight);
            doc.setFontSize(4.5);
            doc.text('PÁGINA', pageBoxX + pageBoxWidth / 2, 8.5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            var numeroPagina = String(pageNumber).padStart(4, '0');
            doc.text(numeroPagina, pageBoxX + pageBoxWidth / 2, 15, { align: 'center' });
            
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.4);
            doc.line(margin, 26, pageWidth - margin, 26);
            
            return 28;
        }
        
        function esImagenValida(url) {
            if (!url) return false;
            if (typeof url !== 'string') return false;
            var urlLower = url.toLowerCase();
            if (urlLower.includes('logo') || urlLower.includes('anguilla') || urlLower.includes('lottery')) return false;
            return true;
        }
        
        function dibujarFoto(persona, x, y) {
            doc.setDrawColor(120, 120, 120);
            doc.setLineWidth(0.3);
            doc.rect(x, y, photoWidth, photoHeight);
            
            if (!esImagenValida(persona.fotoUrl)) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.text('SIN FOTO', x + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
                return;
            }
            
            try {
                var formato = 'JPEG';
                var fotoLower = persona.fotoUrl.toLowerCase();
                if (fotoLower.includes('png') || persona.fotoUrl.startsWith('data:image/png')) formato = 'PNG';
                doc.addImage(persona.fotoUrl, formato, x + 0.5, y + 0.5, photoWidth - 1, photoHeight - 1);
            } catch (error) {
                doc.setFontSize(5);
                doc.text('SIN FOTO', x + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
            }
        }
        
        function dibujarElector(persona, x, y, numero) {
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.25);
            doc.rect(x, y, columnWidth, recordHeight);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.text(String(numero), x + columnWidth - 2, y + 4, { align: 'right' });
            
            var photoX = x + 2;
            var photoY = y + 3;
            
            if (mostrarFoto) {
                dibujarFoto(persona, photoX, photoY);
            } else {
                doc.setDrawColor(120, 120, 120);
                doc.setLineWidth(0.3);
                doc.rect(photoX, photoY, photoWidth, photoHeight);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.text('SIN FOTO', photoX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
            }
            
            var dataX = photoX + photoWidth + 3;
            var dataWidth = columnWidth - photoWidth - 8;
            
            var tipoDoc = persona.tipoDocumento ? safeString(persona.tipoDocumento).toUpperCase() : 'CÉDULA';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.text(tipoDoc + ': ' + (safeString(persona.cedula) || 'N/A'), dataX, y + 7);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            var nombre = (safeString(persona.nombre) || 'SIN NOMBRE').toUpperCase();
            var nombreLines = doc.splitTextToSize(nombre, dataWidth);
            var nombreY = y + 12;
            for (var i = 0; i < Math.min(nombreLines.length, 2); i++) {
                doc.text(nombreLines[i], dataX, nombreY);
                nombreY += 4.5;
            }
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.text('Nacionalidad: ' + (safeString(persona.nacionalidad) || 'N/A').toUpperCase(), dataX, y + 18);
            
            if (persona.direccion) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                var direccion = safeString(persona.direccion).toUpperCase();
                var dirLines = doc.splitTextToSize(direccion, dataWidth);
                var dirY = y + 22;
                for (var d = 0; d < Math.min(dirLines.length, 2); d++) {
                    doc.text(dirLines[d], dataX, dirY);
                    dirY += 4;
                }
            }
            
            if (persona.telefono) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.text('Tel: ' + safeString(persona.telefono), dataX, y + recordHeight - 6);
            }
            
            var firmaX = x + columnWidth - 20;
            var firmaY = y + recordHeight - 6;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.4);
            doc.line(firmaX, firmaY, firmaX + 16, firmaY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(4.5);
            doc.text('FIRMA', firmaX + 8, firmaY + 4, { align: 'center' });
        }
        
        function dibujarPiePagina() {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            var totalPaginas = Math.ceil(datos.length / (Math.floor((pageHeight - 28 - 10) / recordHeight) * 2));
            doc.text('Página ' + pageNumber + ' de ' + totalPaginas, pageWidth / 2, pageHeight - 4, { align: 'center' });
            
            if (conMarcaDeAgua) {
                doc.setTextColor(184, 134, 11);
                doc.setFontSize(4.5);
                doc.text('DOCUMENTO OFICIAL - JUNTA MUNICIPAL SAN LUIS', pageWidth / 2, pageHeight - 1, { align: 'center' });
                doc.setTextColor(0, 0, 0);
            }
        }
        
        var headerStartY = 28;
        var footerSpace = 10;
        var usableHeight = pageHeight - headerStartY - footerSpace;
        var recordsPerColumn = Math.floor(usableHeight / recordHeight);
        if (recordsPerColumn < 1) recordsPerColumn = 1;
        
        var currentIndex = 0;
        
        while (currentIndex < datos.length) {
            if (pageNumber > 1) {
                doc.addPage();
                if (conMarcaDeAgua) {
                    doc.setTextColor(200, 200, 200);
                    doc.setFontSize(60);
                    doc.setFont('helvetica', 'bold');
                    doc.text('CONFIDENCIAL', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
                    doc.setTextColor(0, 0, 0);
                }
            }
            
            var startY = dibujarEncabezado();
            
            for (var izquierda = 0; izquierda < recordsPerColumn; izquierda++) {
                if (currentIndex >= datos.length) break;
                var y = startY + (izquierda * recordHeight);
                dibujarElector(datos[currentIndex], leftColumnX, y, currentIndex + 1);
                currentIndex++;
            }
            
            for (var derecha = 0; derecha < recordsPerColumn; derecha++) {
                if (currentIndex >= datos.length) break;
                var y = startY + (derecha * recordHeight);
                dibujarElector(datos[currentIndex], rightColumnX, y, currentIndex + 1);
                currentIndex++;
            }
            
            dibujarPiePagina();
            pageNumber++;
        }
        
        var fechaActual = new Date().toISOString().slice(0, 10);
        var nombreArchivo = 'Cuadernillo_Censo_JMSL_' + safeString(titulo).replace(/\s/g, '_') + '_' + fechaActual;
        if (conMarcaDeAgua) nombreArchivo += '_CON_MARCA_AGUA';
        nombreArchivo += '.pdf';
        
        doc.save(nombreArchivo);
        showNotification('✅ Cuadernillo PDF generado' + (conMarcaDeAgua ? ' (CON MARCA DE AGUA)' : ''), 'success');
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        showNotification('❌ Error al generar PDF: ' + error.message, 'error');
    }
}

// ============================================================
// REPORTE DE VOTANTES
// ============================================================
function generarReporteVotantes() {
    var items = Object.values(votantesCache).filter(function(v) { return v && typeof v === 'object'; });
    
    if (items.length === 0) {
        showNotification('⚠️ No hay votantes registrados', 'warning');
        return;
    }
    
    items.sort(function(a, b) {
        var sectorA = safeString(a && a.sector).toUpperCase();
        var sectorB = safeString(b && b.sector).toUpperCase();
        if (sectorA < sectorB) return -1;
        if (sectorA > sectorB) return 1;
        var bloqueA = safeString(a && a.bloque);
        var bloqueB = safeString(b && b.bloque);
        if (bloqueA < bloqueB) return -1;
        if (bloqueA > bloqueB) return 1;
        return safeString(a && a.nombre).localeCompare(safeString(b && b.nombre));
    });
    
    try {
        if (typeof window.jspdf === 'undefined') {
            showNotification('❌ jspdf no está cargada', 'error');
            return;
        }
        var jsPDF = window.jspdf.jsPDF;
        if (!jsPDF) {
            showNotification('❌ Error al cargar jspdf', 'error');
            return;
        }
        
        var doc = new jsPDF('p', 'mm', 'letter');
        var pageWidth = doc.internal.pageSize.getWidth();
        var pageHeight = doc.internal.pageSize.getHeight();
        var margin = 6;
        var pageNumber = 1;
        
        var columnGap = 2;
        var columnWidth = ((pageWidth - (margin * 2) - columnGap) / 2);
        var leftColumnX = margin;
        var rightColumnX = margin + columnWidth + columnGap;
        var recordHeight = 30;
        var photoWidth = 18;
        var photoHeight = 22;
        
        function dibujarEncabezado() {
            var logoImg = '';
            try {
                var logoElement = document.querySelector('.nav-logo');
                if (logoElement && logoElement.src) logoImg = logoElement.src;
            } catch (e) {}
            
            if (logoImg) {
                try { doc.addImage(logoImg, 'PNG', margin, 4, 14, 14); } catch (e) {}
            }
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text('JUNTA MUNICIPAL SAN LUIS', margin + 17, 7);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.text('MUNICIPIO SANTO DOMINGO ESTE', margin + 17, 10.5);
            doc.text('RNC: 4-30-017809', margin + 17, 14);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('LISTA DE VOTANTES', pageWidth / 2, 10, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('REGISTRO DE ELECTORES QUE VOTARON', pageWidth / 2, 15, { align: 'center' });
            
            doc.setFontSize(5.5);
            doc.text('TOTAL: ' + items.length + ' VOTANTES', pageWidth / 2, 20, { align: 'center' });
            
            var pageBoxWidth = 24;
            var pageBoxHeight = 13;
            var pageBoxX = pageWidth - margin - pageBoxWidth;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.rect(pageBoxX, 4, pageBoxWidth, pageBoxHeight);
            doc.setFontSize(4.5);
            doc.text('PÁGINA', pageBoxX + pageBoxWidth / 2, 8.5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            var numeroPagina = String(pageNumber).padStart(4, '0');
            doc.text(numeroPagina, pageBoxX + pageBoxWidth / 2, 15, { align: 'center' });
            
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.4);
            doc.line(margin, 23, pageWidth - margin, 23);
            
            return 25;
        }
        
        function esImagenValida(url) {
            if (!url) return false;
            if (typeof url !== 'string') return false;
            var urlLower = url.toLowerCase();
            if (urlLower.includes('logo') || urlLower.includes('anguilla') || urlLower.includes('lottery')) return false;
            return true;
        }
        
        function dibujarFoto(persona, x, y) {
            doc.setDrawColor(120, 120, 120);
            doc.setLineWidth(0.3);
            doc.rect(x, y, photoWidth, photoHeight);
            
            if (!esImagenValida(persona.fotoUrl)) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.text('SIN FOTO', x + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
                return;
            }
            
            try {
                var formato = 'JPEG';
                var fotoLower = persona.fotoUrl.toLowerCase();
                if (fotoLower.includes('png') || persona.fotoUrl.startsWith('data:image/png')) formato = 'PNG';
                doc.addImage(persona.fotoUrl, formato, x + 0.5, y + 0.5, photoWidth - 1, photoHeight - 1);
            } catch (error) {
                doc.setFontSize(5);
                doc.text('SIN FOTO', x + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
            }
        }
        
        function dibujarVotante(persona, x, y, numero) {
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.25);
            doc.rect(x, y, columnWidth, recordHeight);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.text(String(numero), x + columnWidth - 2, y + 4, { align: 'right' });
            
            var photoX = x + 2;
            var photoY = y + 3;
            dibujarFoto(persona, photoX, photoY);
            
            var dataX = photoX + photoWidth + 3;
            var dataWidth = columnWidth - photoWidth - 8;
            
            var tipoDoc = persona.tipoDocumento ? safeString(persona.tipoDocumento).toUpperCase() : 'CÉDULA';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.text(tipoDoc + ': ' + (safeString(persona.cedula) || 'N/A'), dataX, y + 7);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            var nombre = (safeString(persona.nombre) || 'SIN NOMBRE').toUpperCase();
            var nombreLines = doc.splitTextToSize(nombre, dataWidth);
            var nombreY = y + 12;
            for (var i = 0; i < Math.min(nombreLines.length, 2); i++) {
                doc.text(nombreLines[i], dataX, nombreY);
                nombreY += 4.5;
            }
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.text('Nacionalidad: ' + (safeString(persona.nacionalidad) || 'N/A').toUpperCase(), dataX, y + 19);
            
            var sector = safeString(persona.sector).toUpperCase();
            if (sector) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.text('SECTOR: ' + sector, dataX, y + 23);
            }
            
            var selloX = x + columnWidth - 22;
            var selloY = y + recordHeight - 14;
            var selloRadio = 8;
            
            doc.setDrawColor(0, 120, 0);
            doc.setFillColor(0, 180, 0);
            doc.circle(selloX, selloY, selloRadio, 'F');
            doc.setDrawColor(0, 80, 0);
            doc.setLineWidth(0.5);
            doc.circle(selloX, selloY, selloRadio, 'S');
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5);
            doc.setTextColor(255, 255, 255);
            doc.text('VOTÓ', selloX, selloY + 2, { align: 'center' });
            doc.setTextColor(0, 0, 0);
        }
        
        function dibujarPiePagina() {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            var totalPaginas = Math.ceil(items.length / (Math.floor((pageHeight - 25 - 10) / recordHeight) * 2));
            doc.text('Página ' + pageNumber + ' de ' + totalPaginas, pageWidth / 2, pageHeight - 4, { align: 'center' });
        }
        
        var headerStartY = 25;
        var footerSpace = 10;
        var usableHeight = pageHeight - headerStartY - footerSpace;
        var recordsPerColumn = Math.floor(usableHeight / recordHeight);
        if (recordsPerColumn < 1) recordsPerColumn = 1;
        
        var currentIndex = 0;
        
        while (currentIndex < items.length) {
            if (pageNumber > 1) {
                doc.addPage();
            }
            
            var startY = dibujarEncabezado();
            
            for (var izquierda = 0; izquierda < recordsPerColumn; izquierda++) {
                if (currentIndex >= items.length) break;
                var y = startY + (izquierda * recordHeight);
                dibujarVotante(items[currentIndex], leftColumnX, y, currentIndex + 1);
                currentIndex++;
            }
            
            for (var derecha = 0; derecha < recordsPerColumn; derecha++) {
                if (currentIndex >= items.length) break;
                var y = startY + (derecha * recordHeight);
                dibujarVotante(items[currentIndex], rightColumnX, y, currentIndex + 1);
                currentIndex++;
            }
            
            dibujarPiePagina();
            pageNumber++;
        }
        
        var fechaActual = new Date().toISOString().slice(0, 10);
        doc.save('Lista_Votantes_JMSL_' + fechaActual + '.pdf');
        showNotification('✅ Lista de votantes generada', 'success');
        
    } catch (error) {
        console.error('Error al generar reporte de votantes:', error);
        showNotification('❌ Error al generar PDF: ' + error.message, 'error');
    }
}

// ============================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================================
window.addEventListener('load', function() {
    if (usandoFirebase && db) {
        db.ref('.info/connected').on('value', function(snap) {
            const conectado = snap.val() === true;
            actualizarIndicadorConexion(conectado);
        });
    }
});
