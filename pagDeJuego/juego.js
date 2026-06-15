const canvas          = document.getElementById('canvas');
const ctx             = canvas.getContext('2d');
const elEstado        = document.getElementById('estado-conexion');
const elContador      = document.getElementById('contador-jugadores');
const elInfoIP        = document.getElementById('info-ip');
const elQR            = document.getElementById('qr-imagen');

function ajustarCanvas() {
  canvas.width  = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight - 34; 
}
window.addEventListener('resize', ajustarCanvas);
ajustarCanvas();

const NIVELES_DATOS = {
  1: {
    anchoMundo: 1200,
    altoMundo:  570,
    // Plataformas separadas: hay vacíos entre ellas donde el jugador cae
    plataformas: [
      // Suelo izquierdo (no cubre todo el ancho → vacío en el centro)
      { x: 150,  y: 560, ancho: 280,  alto: 20 },
      // Plataforma media (hay que saltar)
      { x: 490,  y: 430, ancho: 160,  alto: 20 },
      // Suelo derecho
      { x: 1000,  y: 560, ancho: 520,  alto: 20 },
      // Plataforma alta (requiere saltar desde la media — bajada para ser alcanzable)
      { x: 850,  y: 380, ancho: 160,  alto: 20 },
      // Paredes laterales (contienen el escenario)
      { x: 10,   y: 290, ancho: 20,   alto: 580 },
      { x: 1190, y: 290, ancho: 20,   alto: 580 },
    ],
    cajas: [
      { x: 200, y: 515, ancho: 44, alto: 44 },
      { x: 950, y: 515, ancho: 44, alto: 44 },
    ],
    posicionPuerta: { x: 1100, y: 550 },  // apoya sobre suelo derecho (y:560 alto:20 → tope en 550)
    posicionLlave:  { x: 850,  y: 340 },  // encima de la plataforma alta (y:380)
  },
  2: {
    anchoMundo: 800,
    altoMundo:  650,
    plataformas: [
      // Suelo izquierdo
      { x: 150,  y: 630, ancho: 280, alto: 20 },
      // Suelo derecho (vacío en el centro → si caés entre los dos, perdés)
      { x: 640,  y: 630, ancho: 280, alto: 20 },
      // Plataforma muy alta (se llega apilándose o con caja)
      { x: 200,  y: 320, ancho: 160, alto: 20 },
      // Plataforma de salida
      { x: 630,  y: 460, ancho: 200, alto: 20 },
      // Paredes
      { x: 10,   y: 325, ancho: 20,  alto: 650 },
      { x: 790,  y: 325, ancho: 20,  alto: 650 },
    ],
    cajas: [
      { x: 180, y: 585, ancho: 44, alto: 44 },
      { x: 230, y: 585, ancho: 44, alto: 44 },
    ],
    posicionPuerta: { x: 710, y: 400 },
    posicionLlave:  { x: 200, y: 280 },
  },
};

let estadoActual = null;

function mostrarQR(url) {
  elInfoIP.textContent = url.replace('http://', '');
  elQR.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(elQR, {
      text:         url,
      width:        130,
      height:       130,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }
}

// ── WebSocket ────────────────────────────────────────────
const urlWS = `ws://${window.location.host}`;
let ws = null;
let intervaloReconexion = null;

function conectarWS() {
  ws = new WebSocket(urlWS);

  ws.onopen = () => {
    elEstado.textContent = '🟢 Conectado';
    // Me identifico como pantalla (no gamepad)
    ws.send(JSON.stringify({ tipo: 'pantalla' }));
    clearInterval(intervaloReconexion);
    intervaloReconexion = null;
  };

  ws.onclose = () => {
    elEstado.textContent = '🔴 Desconectado';
    if (!intervaloReconexion) {
      intervaloReconexion = setInterval(conectarWS, 2000);
    }
  };

  ws.onerror = () => ws.close();

  ws.onmessage = (evento) => {
    let msg;
    try { msg = JSON.parse(evento.data); } catch { return; }

    if (msg.tipo === 'info-servidor') {
      mostrarQR(msg.urlJuego);
    }

    if (msg.tipo === 'estado') {
      estadoActual = msg;
      elContador.textContent = `Jugadores: ${msg.jugadores.length}/4`;
    }
  };
}

// ── Colores ──────────────────────────────────────────────
const COLOR_FONDO      = '#2b2d42';  // gris oscuro — fondo del mapa
const COLOR_VACIO      = '#111318';  // negro — el vacío donde se cae
const COLOR_PLATAFORMA = '#e0e0e0';  // gris claro — plataformas
const COLOR_CAJA       = '#c0763a';  // marrón — cajas de madera
const COLOR_PUERTA_C   = '#555566';  // gris — puerta cerrada
const COLOR_PUERTA_A   = '#2ecc71';  // verde — puerta abierta
const COLOR_LLAVE      = '#f5c542';  // amarillo — llave

// ── Funciones de dibujo ──────────────────────────────────

function dibujarPlataforma(p, eX, eY) {
  const x = (p.x - p.ancho / 2) * eX;
  const y = (p.y - p.alto  / 2) * eY;
  const w = p.ancho * eX;
  const h = p.alto  * eY;

  ctx.fillStyle = COLOR_PLATAFORMA;
  ctx.fillRect(x, y, w, h);

  // Borde oscuro abajo para dar sensación de bloque
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + h - 3, w, 3);
}

function dibujarCaja(caja, eX, eY) {
  const TAM = 44;
  const x = (caja.x - TAM / 2) * eX;
  const y = (caja.y - TAM / 2) * eY;
  const w = TAM * eX;
  const h = TAM * eY;

  ctx.fillStyle = COLOR_CAJA;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = '#8b4a1e';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Cruz de madera
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x,   y);   ctx.lineTo(x+w, y+h);
  ctx.moveTo(x+w, y);   ctx.lineTo(x,   y+h);
  ctx.stroke();
}

function dibujarPuerta(px, py, eX, eY, abierta) {
  const x = (px - 24) * eX;
  const y = (py - 60) * eY;
  const w = 48 * eX;
  const h = 60 * eY;

  ctx.fillStyle   = abierta ? COLOR_PUERTA_A : COLOR_PUERTA_C;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  // Texto pequeño para que entre en la puerta (48px de ancho)
  ctx.fillStyle    = 'white';
  ctx.font         = `bold ${Math.max(7, 8 * Math.min(eX, eY))}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(abierta ? 'META' : 'SALIR', px * eX, (py - 30) * eY);
  ctx.textBaseline = 'alphabetic';
}

function dibujarLlave(lx, ly, eX, eY) {
  const cx = lx * eX;
  const cy = ly * eY;
  const r  = 12 * Math.min(eX, eY);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle   = COLOR_LLAVE;
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.fillStyle    = '#5a3e00';
  ctx.font         = `bold ${Math.max(10, 13 * Math.min(eX, eY))}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('K', cx, cy);
  ctx.textBaseline = 'alphabetic';
}

function dibujarJugador(j, eX, eY) {
  const W = 36, H = 54;
  const jx = j.x * eX;
  const jy = j.y * eY;
  const w  = W * eX;
  const h  = H * eY;

  // Cuerpo
  ctx.fillStyle = j.color;
  ctx.beginPath();
  ctx.roundRect(jx - w/2, jy - h/2, w, h, 5);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Número encima
  const num = j.nombre.replace('Jugador ', '');
  ctx.fillStyle    = '#fff';
  ctx.font         = `bold ${Math.max(8, 10 * Math.min(eX, eY))}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(num, jx, jy - h/2 - 2);
  ctx.textBaseline = 'alphabetic';

  // Indica si lleva la llave
  if (j.cargandoLlave) {
    ctx.fillStyle    = COLOR_LLAVE;
    ctx.font         = `${Math.max(9, 11 * Math.min(eX, eY))}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('🗝', jx, jy - h/2 - 14);
    ctx.textBaseline = 'alphabetic';
  }
}

function dibujar() {
  requestAnimationFrame(dibujar);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const numNivel = estadoActual?.nivelActual ?? 1;
  const nivel    = NIVELES_DATOS[numNivel];
  if (!nivel) return;

  const eX = canvas.width  / nivel.anchoMundo;
  const eY = canvas.height / nivel.altoMundo;

  // Fondo oscuro (el "vacío" donde se cae)
  ctx.fillStyle = COLOR_VACIO;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLOR_FONDO;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // IMPORTANTE: el vacío se pinta encima del fondo
  // Las zonas sin plataforma son negras (COLOR_VACIO)
  // Lo logramos dibujando el vacío SOLO en la parte de abajo
  const yPisoMundo = nivel.altoMundo * eY;
  ctx.fillStyle = COLOR_VACIO;
  ctx.fillRect(0, yPisoMundo - 1, canvas.width, canvas.height - yPisoMundo + 1);

  // Plataformas (se dibujan ANTES del texto para que el texto quede encima)
  for (const p of nivel.plataformas) {
    dibujarPlataforma(p, eX, eY);
  }

  ctx.fillStyle    = 'rgba(255,255,255,0.75)';
  ctx.font         = `bold ${Math.max(12, 15 * eX)}px monospace`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`NIVEL ${numNivel}`, 34, 8);
  ctx.textBaseline = 'alphabetic';

  if (!estadoActual) return;

  if (estadoActual.cajas) {
    for (const caja of estadoActual.cajas) {
      dibujarCaja(caja, eX, eY);
    }
  }

  dibujarPuerta(
    nivel.posicionPuerta.x,
    nivel.posicionPuerta.y,
    eX, eY,
    estadoActual.llaveRecogida
  );

  if (estadoActual.llaveEnJuego && estadoActual.llaveX != null) {
    dibujarLlave(estadoActual.llaveX, estadoActual.llaveY, eX, eY);
  }

  for (const j of estadoActual.jugadores) {
    dibujarJugador(j, eX, eY);
  }

  // Aviso de cuántos jugadores faltan para la llave
  if (estadoActual.jugadores.length < 3) {
    const faltan = 3 - estadoActual.jugadores.length;
    ctx.fillStyle    = 'rgba(245,197,66,0.9)';
    ctx.font         = `bold ${Math.max(11, 13 * Math.min(eX, eY))}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `Faltan ${faltan} jugador${faltan > 1 ? 'es' : ''} para la llave`,
      canvas.width / 2,
      14
    );
    ctx.textBaseline = 'alphabetic';
  }
}

// ── Arrancar ─────────────────────────────────────────────
conectarWS();
dibujar();