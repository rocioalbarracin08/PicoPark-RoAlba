// servidor-ws.ts
// Maneja conexiones WebSocket y el loop principal del juego.
// La física corre aquí en el servidor — nunca en el celular.

import { WebSocketServer, WebSocket } from 'ws';
import Matter from 'matter-js';
import {
  crearEstadoInicial,
  CONFIGS_JUGADORES,
  MAX_JUGADORES,
  MIN_PARA_GANAR,
} from './tipos';
import type { EstadoJuego } from './tipos';
import {
  crearMotorFisico,
  crearCuerpoJugador,
  aplicarMovimiento,
  estaEnSuelo,
  avanzarMotor,
} from './motor';
import { NIVELES } from './niveles';

const inputsActivos = new Map<string, Set<string>>();
const ultimoInput   = new Map<string, number>(); // para rate limiting
const INTERVALO_MS  = 1000 / 30;                 // 30 FPS = 33ms

export function iniciarServidorWS(puerto: number): WebSocketServer {
  const wss    = new WebSocketServer({ port: puerto });
  const estado: EstadoJuego = crearEstadoInicial();
  const motor  = crearMotorFisico(NIVELES[0]);

  setInterval(() => {
    if (contarConectados(estado) === 0) return;

    // 1. Avanzar física (reemplaza Runner que necesita window)
    avanzarMotor(motor.motor, INTERVALO_MS);

    // 2. Aplicar inputs de cada jugador conectado
    for (const [id, jugador] of estado.jugadores) {
      if (!jugador.conectado) continue;
      const inputs  = inputsActivos.get(id) ?? new Set();
      const enSuelo = estaEnSuelo(jugador.cuerpofisico, motor.motor);
      aplicarMovimiento(jugador.cuerpofisico, inputs, enSuelo);
    }

    // 3. Verificar llave, puerta y caídas al vacío
    verificarLogicaJuego(estado, motor, wss);

    // 4. Transmitir snapshot del mundo a todos los clientes conectados
    broadcast(wss, construirSnapshot(estado));

  }, INTERVALO_MS);

  // ─── Nueva conexión ──────────────────────────────────────────────────────
  wss.on('connection', (socket: WebSocket) => {
    const jugadoresActivos = [...estado.jugadores.values()].filter(j => j.conectado);

    // Rechazar si ya hay 4 — hot-join controlado
    if (jugadoresActivos.length >= MAX_JUGADORES) {
      socket.send(JSON.stringify({
        tipo:    'error',
        mensaje: 'El juego está lleno. Máximo 4 jugadores.',
      }));
      socket.close();
      return;
    }

    const idSocket = generarId();
    const indice   = jugadoresActivos.length;
    const config   = CONFIGS_JUGADORES[indice];
    const nivel    = NIVELES[estado.nivelActual - 1];
    const posicion = nivel.posicionesIniciales[indice];

    // Crear y registrar cuerpo físico
    const cuerpo = crearCuerpoJugador(posicion.x, posicion.y, idSocket);
    Matter.World.add(motor.mundo, cuerpo);

    estado.jugadores.set(idSocket, {
      id:            idSocket,
      nombre:        config.nombre,
      color:         config.color,
      cuerpofisico:  cuerpo,
      cargandoLlave: false,
      conectado:     true,
    });

    // Apenas hay alguien, el juego está activo
    estado.fase = 'jugando';

    inputsActivos.set(idSocket, new Set());
    ultimoInput.set(idSocket, 0);

    console.log(`✅ ${config.nombre} conectado — jugadores: ${contarConectados(estado)}/${MAX_JUGADORES}`);

    // Handshake: el celular sabe quién es
    socket.send(JSON.stringify({
      tipo:   'bienvenida',
      id:     idSocket,
      nombre: config.nombre,
      color:  config.color,
    }));

    // La pantalla PC sabe que entró alguien nuevo
    broadcast(wss, {
      tipo:                'jugador-unido',
      id:                  idSocket,
      nombre:              config.nombre,
      color:               config.color,
      jugadoresConectados: contarConectados(estado),
    });

    // ─── Inputs del celular con rate limiting ────────────────────────────
    socket.on('message', (datos: Buffer) => {
      const ahora  = Date.now();
      const ultimo = ultimoInput.get(idSocket) ?? 0;
      if (ahora - ultimo < 16) return;
      ultimoInput.set(idSocket, ahora);

      try {
        const msg = JSON.parse(datos.toString());
        if (msg.tipo !== 'input') return;

        const inputs = inputsActivos.get(idSocket);
        if (!inputs) return;

        // keydown → agregar, keyup → quitar
        if (msg.estado === 'presionado') {
          inputs.add(msg.direccion);
        } else {
          inputs.delete(msg.direccion);
        }
      } catch {
        // Mensaje malformado: ignorar sin crashear el servidor
      }
    });

    // ─── Desconexión ─────────────────────────────────────────────────────
    socket.on('close', () => {
      const jugador = estado.jugadores.get(idSocket);
      if (!jugador) return;

      jugador.conectado = false;
      Matter.World.remove(motor.mundo, jugador.cuerpofisico);

      if (jugador.cargandoLlave) {
        jugador.cargandoLlave = false;
        estado.llaveRecogida  = false;
        estado.llaveEnJuego   = true;
        reaparecerLlave(motor, estado.nivelActual);
        broadcast(wss, { tipo: 'llave-reaparecio' });
      }

      //volvemos a estado de espera
      if (contarConectados(estado) === 0) {
        estado.fase = 'esperando';
      }

      //evitar memory leak
      inputsActivos.delete(idSocket);
      ultimoInput.delete(idSocket);

      console.log(`❌ ${jugador.nombre} desconectado — jugadores: ${contarConectados(estado)}/${MAX_JUGADORES}`);

      broadcast(wss, {
        tipo:                'jugador-desconectado',
        id:                  idSocket,
        nombre:              jugador.nombre,
        jugadoresConectados: contarConectados(estado),
      });
    });
  });

  return wss;
}

// ─── Lógica del juego ────────────────────────────────────────────────────────
function verificarLogicaJuego(
  estado: EstadoJuego,
  motor:  ReturnType<typeof crearMotorFisico>,
  wss:    WebSocketServer,
): void {
  const nivel            = NIVELES[estado.nivelActual - 1];
  const jugadoresActivos = [...estado.jugadores.values()].filter(j => j.conectado);

  for (const jugador of jugadoresActivos) {
    const pos = jugador.cuerpofisico.position;

    if (estado.llaveEnJuego && !estado.llaveRecogida && motor.cuerpoLlave) {
      const distancia = Math.hypot(
        pos.x - motor.cuerpoLlave.position.x,
        pos.y - motor.cuerpoLlave.position.y,
      );

      if (distancia < 40) {
        jugador.cargandoLlave = true;
        estado.llaveRecogida  = true;
        estado.llaveEnJuego   = false;
        Matter.World.remove(motor.mundo, motor.cuerpoLlave);
        motor.cuerpoLlave     = null;
        broadcast(wss, { tipo: 'llave-recogida', jugadorId: jugador.id });
      }
    }

    if (jugador.cargandoLlave && pos.y > nivel.altoMundo + 100) {
      jugador.cargandoLlave = false;
      estado.llaveRecogida  = false;
      estado.llaveEnJuego   = true;
      reaparecerLlave(motor, estado.nivelActual);
      broadcast(wss, { tipo: 'llave-reaparecio' });
    }
  }

  if (!estado.llaveRecogida || !motor.cuerposPuerta[0]) return;
  if (jugadoresActivos.length < MIN_PARA_GANAR) return;

  const puerta        = motor.cuerposPuerta[0];
  const todosEnPuerta = jugadoresActivos.every(j =>
    Matter.Bounds.contains(puerta.bounds, j.cuerpofisico.position)
  );

  if (todosEnPuerta) {
    estado.fase = 'nivel-completado';
    broadcast(wss, { tipo: 'nivel-completado', nivel: estado.nivelActual });
    console.log(`🏆 Nivel ${estado.nivelActual} completado con ${jugadoresActivos.length} jugadores`);
  }
}

function reaparecerLlave(
  motor:       ReturnType<typeof crearMotorFisico>,
  nivelActual: number,
): void {
  const nivel      = NIVELES[nivelActual - 1];
  const nuevaLlave = Matter.Bodies.circle(
    nivel.posicionLlave.x,
    nivel.posicionLlave.y,
    15,
    { isStatic: true, label: 'llave' }
  );
  Matter.World.add(motor.mundo, nuevaLlave);
  motor.cuerpoLlave = nuevaLlave;
}

function construirSnapshot(estado: EstadoJuego) {
  return {
    tipo:      'estado',
    fase:      estado.fase,
    jugadores: [...estado.jugadores.values()].map(j => ({
      id:            j.id,
      nombre:        j.nombre,
      color:         j.color,
      x:             Math.round(j.cuerpofisico.position.x),
      y:             Math.round(j.cuerpofisico.position.y),
      cargandoLlave: j.cargandoLlave,
      conectado:     j.conectado,
    })),
    llaveEnJuego:  estado.llaveEnJuego,
    llaveRecogida: estado.llaveRecogida,
    nivelActual:   estado.nivelActual,
    minParaGanar:  MIN_PARA_GANAR,
  };
}

function broadcast(wss: WebSocketServer, datos: object): void {
  const mensaje = JSON.stringify(datos);
  wss.clients.forEach((cliente) => {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(mensaje);
    }
  });
}

function contarConectados(estado: EstadoJuego): number {
  return [...estado.jugadores.values()].filter(j => j.conectado).length;
}

function generarId(): string {
  return Math.random().toString(36).slice(2, 9);
}