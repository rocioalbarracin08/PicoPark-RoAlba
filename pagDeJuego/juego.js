const canvas     = document.getElementById('canvas');
const ctx        = canvas.getContext('2d');
const elEstado   = document.getElementById('estado-conexion');
const elContador = document.getElementById('contador-jugadores');
const pantallaEspera   = document.getElementById('pantalla-espera');
const pantallaVictoria = document.getElementById('pantalla-victoria');

//Conectarse al servidor (misma IP, puerto 3000)
const SERVIDOR_URL = `http://${window.location.hostname}:3000`;
const socket = io(SERVIDOR_URL, {
  query: { tipo: 'pantalla' },

  transports: ['websocket'],

  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: Infinity,
});

let estadoActual = null;
let nivelActual  = null;

socket.on('connect', () => {
  elEstado.textContent = '🟢 Conectado';
});

socket.on('disconnect', () => {
  elEstado.textContent = '🔴 Desconectado';
});

// Recibir estado del servidor 
socket.on('estado', (data) => {
  estadoActual = data;
  elContador.textContent = `Jugadores: ${data.jugadores.length}/4`;

  if (data.fase === 'esperando') {
    pantallaEspera.classList.remove('oculto');
    pantallaVictoria.classList.add('oculto');
  } else if (data.fase === 'nivel-completado') {
    pantallaVictoria.classList.remove('oculto');
    pantallaEspera.classList.add('oculto');
  } else {
    pantallaEspera.classList.add('oculto');
    pantallaVictoria.classList.add('oculto');
  }
});

socket.on('jugador-desconectado', ({ nombre }) => {
  console.log(`${nombre} se desconectó`);
});

function ajustarCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', ajustarCanvas);
ajustarCanvas();

function escalar(valor, base, tamaño) {
  return (valor / base) * tamaño;
}

function dibujar() {
  requestAnimationFrame(dibujar);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!estadoActual) return;

  const nivel = estadoActual.nivelActual === 1
    ? { ancho: 1200, alto: 600, plataformas: [
        { x: 600,  y: 580, ancho: 1200, alto: 20 },
        { x: 400,  y: 420, ancho: 200,  alto: 20 },
        { x: 900,  y: 300, ancho: 200,  alto: 20 },
        { x: 0,    y: 300, ancho: 20,   alto: 600 },
        { x: 1200, y: 300, ancho: 20,   alto: 600 },
      ], puerta: { x: 1150, y: 520 } }
    : { ancho: 800, alto: 700, plataformas: [
        { x: 400, y: 680, ancho: 800, alto: 20 },
        { x: 200, y: 300, ancho: 160, alto: 20 },
        { x: 650, y: 500, ancho: 200, alto: 20 },
        { x: 0,   y: 350, ancho: 20,  alto: 700 },
        { x: 800, y: 350, ancho: 20,  alto: 700 },
      ], puerta: { x: 650, y: 450 } };

  const sx = canvas.width  / nivel.ancho;
  const sy = canvas.height / nivel.alto;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#4a4a6a';
  for (const p of nivel.plataformas) {
    ctx.fillRect(
      (p.x - p.ancho / 2) * sx,
      (p.y - p.alto  / 2) * sy,
      p.ancho * sx,
      p.alto  * sy
    );
  }

  ctx.fillStyle = estadoActual.llaveRecogida ? '#00ff88' : '#555';
  ctx.fillRect(
    (nivel.puerta.x - 30) * sx,
    (nivel.puerta.y - 40) * sy,
    60 * sx,
    80 * sy
  );
  ctx.fillStyle = 'white';
  ctx.font = `${20 * Math.min(sx, sy)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(
    estadoActual.llaveRecogida ? '🚪' : '🔒',
    nivel.puerta.x * sx,
    (nivel.puerta.y + 10) * sy
  );

  // Llave (solo si está en el mundo)
  if (estadoActual.llaveEnJuego && estadoActual.llaveX != null) {
    ctx.font = `${24 * Math.min(sx, sy)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('🗝️', estadoActual.llaveX * sx, estadoActual.llaveY * sy);
  }

  // Jugadores
  for (const j of estadoActual.jugadores) {
    const jx = j.x * sx;
    const jy = j.y * sy;
    const w  = 40 * sx;
    const h  = 60 * sy;

    ctx.fillStyle = j.color;
    ctx.beginPath();
    ctx.roundRect(jx - w/2, jy - h/2, w, h, 6);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = `bold ${11 * Math.min(sx, sy)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(j.nombre.split(' ')[1], jx, jy - h/2 - 5 * sy);

    if (j.cargandoLlave) {
      ctx.font = `${16 * Math.min(sx, sy)}px monospace`;
      ctx.fillText('🗝️', jx, jy);
    }
  }
}

dibujar();