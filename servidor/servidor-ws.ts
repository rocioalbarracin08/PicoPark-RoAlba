import { Server as IOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import Matter from 'matter-js';
import {
  crearMotorFisico,
  crearCuerpoJugador,
  aplicarMovimiento,
  estaEnSuelo,
  avanzarMotor,
  type MotorFisico,
} from './motor';
import { NIVELES } from './niveles';
import {
  crearEstadoInicial,
  CONFIGS_JUGADORES,
  MAX_JUGADORES,
  MIN_PARA_GANAR,
} from './tipos';
import type { EstadoJuego } from './tipos';

const TICK_MS = 33; // ~30 FPS

export function iniciarServidorWS(puerto: number, dirPagDeJuego: string) {

  // ── HTTP server que sirve pagDeJuego ──────────────────────────────────────
  const httpServer = createServer((req, res) => {
    const url = req.url ?? '/';

    const mapa: Record<string, string> = {
      '/':            'index.html',
      '/index.html':  'index.html',
      '/juego.js':    'juego.js',
      '/estilos.css': 'estilos.css',
    };

    const tipos: Record<string, string> = {
      'index.html':  'text/html; charset=utf-8',
      'juego.js':    'application/javascript; charset=utf-8',
      'estilos.css': 'text/css; charset=utf-8',
    };

    const archivo = mapa[url];
    if (archivo) {
      try {
        const contenido = readFileSync(join(dirPagDeJuego, archivo));
        res.writeHead(200, { 'Content-Type': tipos[archivo] });
        res.end(contenido);
      } catch {
        res.writeHead(404);
        res.end('Archivo no encontrado');
      }
    } else {
      res.writeHead(404);
      res.end('404');
    }
  });

  // ── socket.io sobre el mismo HTTP server ──────────────────────────────────
  const io = new IOServer(httpServer, {
    cors:         { origin: '*' },
    pingTimeout:  10000,
    pingInterval: 3000,
  });

  const estado        = crearEstadoInicial();
  const motor         = crearMotorFisico(NIVELES[estado.nivelActual - 1]);
  const inputsActivos = new Map<string, Set<string>>();

  // ── Game loop ~30 FPS ─────────────────────────────────────────────────────
  let ultimoTick = Date.now();
  setInterval(() => {
    const ahora = Date.now();
    const delta = ahora - ultimoTick;
    ultimoTick  = ahora;

    for (const [, jugador] of estado.jugadores) {
      if (!jugador.conectado) continue;
      const inputs  = inputsActivos.get(jugador.id) ?? new Set();
      const enSuelo = estaEnSuelo(jugador.cuerpofisico, motor.motor);
      aplicarMovimiento(jugador.cuerpofisico, inputs, enSuelo);
    }

    avanzarMotor(motor.motor, delta);
    verificarLogicaJuego(estado, motor, io);
    io.emit('estado', construirSnapshot(estado, motor));
  }, TICK_MS);

  // ── Conexión de un cliente ────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const tipo = socket.handshake.query.tipo;

    // La pantalla del juego se conecta solo para recibir estado
    if (tipo === 'pantalla') {
      console.log('🖥️  Pantalla del juego conectada');
      return;
    }

    // Gamepad: verificar límite de jugadores
    const conectados = contarConectados(estado);
    if (conectados >= MAX_JUGADORES) {
      console.log(`🚫 Partida llena — rechazado (${socket.id})`);
      socket.emit('partida-llena');
      socket.disconnect(true);
      return;
    }

    // Asignar jugador
    const config = CONFIGS_JUGADORES[conectados];
    const nivel  = NIVELES[estado.nivelActual - 1];
    const pos    = nivel.posicionesIniciales[conectados];
    const cuerpo = crearCuerpoJugador(pos.x, pos.y, socket.id);
    Matter.World.add(motor.mundo, cuerpo);

    estado.jugadores.set(socket.id, {
      id:            socket.id,
      nombre:        config.nombre,
      color:         config.color,
      cuerpofisico:  cuerpo,
      cargandoLlave: false,
      conectado:     true,
    });
    inputsActivos.set(socket.id, new Set());

    // Con 1 jugador ya se puede mover
    if (estado.fase === 'esperando') {
      estado.fase = 'jugando';
    }

    socket.emit('bienvenido', {
      id:     socket.id,
      nombre: config.nombre,
      color:  config.color,
    });

    console.log(`✅ ${config.nombre} conectado — jugadores: ${contarConectados(estado)}/${MAX_JUGADORES}`);

    // ── Input del gamepad ──────────────────────────────────────────────────
    socket.on('input', (msg: { direccion: string; estado: 'presionado' | 'soltado' }) => {
      const inputs = inputsActivos.get(socket.id);
      if (!inputs) return;
      if (msg.estado === 'presionado') {
        inputs.add(msg.direccion);
      } else {
        inputs.delete(msg.direccion);
      }
    });

    // ── Desconexión ────────────────────────────────────────────────────────
    socket.on('disconnect', (razon) => {
      const jugador = estado.jugadores.get(socket.id);
      if (!jugador) return;

      jugador.conectado = false;
      Matter.World.remove(motor.mundo, jugador.cuerpofisico);

      if (jugador.cargandoLlave) {
        jugador.cargandoLlave = false;
        estado.llaveRecogida  = false;
        estado.llaveEnJuego   = true;
        reaparecerLlave(motor, estado.nivelActual);
        io.emit('llave-reaparecio');
      }

      if (contarConectados(estado) === 0) {
        estado.fase = 'esperando';
      }

      inputsActivos.delete(socket.id);
      console.log(`❌ ${jugador.nombre} desconectado (${razon}) — jugadores: ${contarConectados(estado)}/${MAX_JUGADORES}`);
      io.emit('jugador-desconectado', { id: socket.id, nombre: jugador.nombre });
    });
  });

  // ── Arrancar servidor ─────────────────────────────────────────────────────
  httpServer.listen(puerto, '0.0.0.0', () => {
    console.log(`🟢 Servidor escuchando en puerto ${puerto}`);
  });

  return io;
}

// ── Funciones auxiliares (fuera de iniciarServidorWS) ─────────────────────

function contarConectados(estado: EstadoJuego): number {
  let count = 0;
  for (const j of estado.jugadores.values()) {
    if (j.conectado) count++;
  }
  return count;
}

function construirSnapshot(estado: EstadoJuego, motor: MotorFisico) {
  const jugadores = [];
  for (const j of estado.jugadores.values()) {
    if (!j.conectado) continue;
    jugadores.push({
      id:            j.id,
      nombre:        j.nombre,
      color:         j.color,
      x:             j.cuerpofisico.position.x,
      y:             j.cuerpofisico.position.y,
      cargandoLlave: j.cargandoLlave,
    });
  }

  const nivel = NIVELES[estado.nivelActual - 1];
  return {
    fase:          estado.fase,
    jugadores,
    llaveEnJuego:  estado.llaveEnJuego,
    llaveRecogida: estado.llaveRecogida,
    nivelActual:   estado.nivelActual,
    minParaGanar:  MIN_PARA_GANAR,
    llaveX: estado.llaveEnJuego && motor.cuerpoLlave ? motor.cuerpoLlave.position.x : null,
    llaveY: estado.llaveEnJuego && motor.cuerpoLlave ? motor.cuerpoLlave.position.y : null,
    puertaX: nivel.posicionPuerta.x,
    puertaY: nivel.posicionPuerta.y,
  };
}

function reaparecerLlave(motor: MotorFisico, nivelActual: number) {
  if (!motor.cuerpoLlave) return;
  const nivel = NIVELES[nivelActual - 1];
  Matter.Body.setPosition(motor.cuerpoLlave, {
    x: nivel.posicionLlave.x,
    y: nivel.posicionLlave.y,
  });
  Matter.Body.setVelocity(motor.cuerpoLlave, { x: 0, y: 0 });
}

function verificarLogicaJuego(estado: EstadoJuego, motor: MotorFisico, io: IOServer) {
  if (estado.fase !== 'jugando') return;

  const activos = [...estado.jugadores.values()].filter(j => j.conectado);
  const nivel   = NIVELES[estado.nivelActual - 1];

  // Alguien agarra la llave
  if (estado.llaveEnJuego && !estado.llaveRecogida && motor.cuerpoLlave) {
    for (const jugador of activos) {
      const dx = jugador.cuerpofisico.position.x - motor.cuerpoLlave.position.x;
      const dy = jugador.cuerpofisico.position.y - motor.cuerpoLlave.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < 40) {
        jugador.cargandoLlave = true;
        estado.llaveRecogida  = true;
        estado.llaveEnJuego   = false;
        io.emit('llave-recogida', { jugadorId: jugador.id });
        break;
      }
    }
  }

  // Jugador con llave cae al vacío → respawn llave
  for (const jugador of activos) {
    if (jugador.cargandoLlave && jugador.cuerpofisico.position.y > nivel.altoMundo + 50) {
      jugador.cargandoLlave = false;
      estado.llaveRecogida  = false;
      estado.llaveEnJuego   = true;
      reaparecerLlave(motor, estado.nivelActual);
      io.emit('llave-reaparecio');
    }
  }

  // Victoria: ≥ MIN_PARA_GANAR cerca de la puerta con la llave
  if (estado.llaveRecogida) {
    const enSalida = activos.filter(j => {
      const dx = Math.abs(j.cuerpofisico.position.x - nivel.posicionPuerta.x);
      const dy = Math.abs(j.cuerpofisico.position.y - nivel.posicionPuerta.y);
      return dx < 60 && dy < 80;
    });
    if (enSalida.length >= MIN_PARA_GANAR) {
      estado.fase = 'nivel-completado';
      io.emit('nivel-completado', { nivel: estado.nivelActual });
    }
  }
}