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
} from './fisica';

import { NIVELES } from './configuracionNiveles';

import {
  crearEstadoInicial,
  CONFIGS_JUGADORES,
  MAX_JUGADORES,
  MIN_PARA_GANAR,
} from './configuracionJugadores';

import type { Jugador } from './configuracionJugadores';

const TICK_RATE = 1000 / 60;

interface JugadorInterno extends Jugador {
  slotIndex: number;
}

export function iniciarServidorWS(puerto: number, dirPagDeJuego: string) {

  // HTTP 
  const httpServer = createServer((req, res) => {
    const url = req.url ?? '/';
    const mapa: Record<string, string> = {
      '/': 'index.html',
      '/index.html': 'index.html',
      '/juego.js': 'juego.js',
      '/estilos.css': 'estilos.css',
    };
    const tipos: Record<string, string> = {
      'index.html': 'text/html',
      'juego.js': 'application/javascript',
      'estilos.css': 'text/css',
    };
    const archivo = mapa[url];
    if (!archivo) { res.writeHead(404); res.end('404'); return; }
    try {
      const contenido = readFileSync(join(dirPagDeJuego, archivo));
      res.writeHead(200, { 'Content-Type': tipos[archivo] });
      res.end(contenido);
    } catch {
      res.writeHead(500); res.end('error');
    }
  });

  const io = new IOServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  const estado       = crearEstadoInicial();
  const motor        = crearMotorFisico();
  const nivelConfig  = NIVELES[estado.nivelActual - 1];
  const inputsActivos = new Map<string, Set<string>>();
  const slotsLibres: number[] = [0, 1, 2, 3];

  for (const p of nivelConfig.plataformas) {
    Matter.World.add(motor.mundo,
      Matter.Bodies.rectangle(p.x, p.y, p.ancho, p.alto, {
        isStatic: true,
        label: p.etiqueta ?? 'plataforma',
      })
    );
  }

  let cuerpoLlave: Matter.Body | null = Matter.Bodies.circle(
    nivelConfig.posicionLlave.x,
    nivelConfig.posicionLlave.y,
    18,
    { isStatic: true, isSensor: true, label: 'llave' }
  );
  Matter.World.add(motor.mundo, cuerpoLlave);

  function reaparecerLlave() {
    if (!cuerpoLlave) return;
    Matter.Body.setPosition(cuerpoLlave, {
      x: nivelConfig.posicionLlave.x,
      y: nivelConfig.posicionLlave.y,
    });
    estado.llaveEnJuego  = true;
    estado.llaveRecogida = false;
    for (const j of estado.jugadores.values()) {
      j.cargandoLlave = false;
    }
  }

  let ultimoTick = Date.now();

  setInterval(() => {
    const ahora = Date.now();
    const delta = Math.min(ahora - ultimoTick, 50);
    ultimoTick  = ahora;

    for (const jugador of estado.jugadores.values()) {
      const inputs  = inputsActivos.get(jugador.id) ?? new Set();
      const enSuelo = estaEnSuelo(jugador.cuerpofisico, motor.motor);
      aplicarMovimiento(jugador.cuerpofisico, inputs, enSuelo);
    }

    avanzarMotor(motor.motor, delta);

    const cantJugadores = estado.jugadores.size;
    if (cantJugadores < MIN_PARA_GANAR) {
      if (estado.llaveEnJuego) {
        estado.llaveEnJuego = false;
      }
    } else if (!estado.llaveEnJuego && !estado.llaveRecogida) {
      estado.llaveEnJuego = true;
    }

    // Alguien agarra la llave 
    if (estado.llaveEnJuego && !estado.llaveRecogida && cuerpoLlave) {
      for (const jugador of estado.jugadores.values()) {
        const dx = Math.abs(jugador.cuerpofisico.position.x - cuerpoLlave.position.x);
        const dy = Math.abs(jugador.cuerpofisico.position.y - cuerpoLlave.position.y);
        if (dx < 40 && dy < 50) {
          jugador.cargandoLlave = true;
          estado.llaveRecogida  = true;
          estado.llaveEnJuego   = false;
          io.emit('llave-recogida', { jugadorId: jugador.id, nombre: jugador.nombre });
          console.log(`🗝️  ${jugador.nombre} agarró la llave`);
          break;
        }
      }
    }

    for (const jugador of estado.jugadores.values()) {
      if (jugador.cargandoLlave && jugador.cuerpofisico.position.y > nivelConfig.altoMundo + 100) {
        console.log(`🗝️  ${jugador.nombre} cayó con la llave — reaparece`);
        reaparecerLlave();
        io.emit('llave-reaparecio');
        break;
      }
    }


if (estado.fase === 'jugando') {
  const puerta    = nivelConfig.posicionPuerta;
  const jugadores = [...estado.jugadores.values()];

  // Jugadores que están cerca de la puerta Y presionando arriba
  const entrando = jugadores.filter(j => {
    const inputs = inputsActivos.get(j.id);
    if (!inputs?.has('arriba')) return false;
    const dx = Math.abs(j.cuerpofisico.position.x - puerta.x);
    const dy = Math.abs(j.cuerpofisico.position.y - puerta.y);
    return dx < 60 && dy < 80;
  });

  // Cuenta como "en salida" a quien entró con arriba (tiene llave) o está cerca
  // La puerta solo abre si alguien con la llave la activa primero
  const hayLlaveEnPuerta = entrando.some(j => j.cargandoLlave);

  if (hayLlaveEnPuerta || estado.llaveRecogida) {
    // Una vez que la llave llegó a la puerta, los demás también pueden entrar con arriba
    if (entrando.length >= MIN_PARA_GANAR) {
      estado.fase = 'nivel-completado';
      io.emit('nivel-completado', { nivel: estado.nivelActual });
      console.log(`Nivel ${estado.nivelActual} completado!`);
    }
  }
}

    io.emit('estado', construirSnapshot(estado, cuerpoLlave));

  }, TICK_RATE);

  // Conexiones 
  io.on('connection', (socket: Socket) => {
    const tipo = socket.handshake.query.tipo;

    if (tipo === 'pantalla') {
      console.log('🖥️ Pantalla conectada');
      socket.on('disconnect', (r) => console.log(`🖥️ Pantalla desconectada (${r})`));
      return;
    }

    // Gamepad: verificar slots
    if (slotsLibres.length === 0) {
      socket.emit('partida-llena'); 
      socket.disconnect();
      console.log(`🚫 Partida llena — rechazado (${socket.id})`);
      return;
    }

    const slotIndex = slotsLibres.shift()!;
    const config    = CONFIGS_JUGADORES[slotIndex];
    const spawn     = nivelConfig.posicionesIniciales[slotIndex];
    const cuerpo    = crearCuerpoJugador(spawn.x, spawn.y, socket.id);

    Matter.World.add(motor.mundo, cuerpo);

    const jugador: JugadorInterno = {
      id:            socket.id,
      nombre:        config.nombre,
      color:         config.color,
      cuerpofisico:  cuerpo,
      conectado:     true,
      cargandoLlave: false,
      slotIndex,
    };

    estado.jugadores.set(socket.id, jugador);
    inputsActivos.set(socket.id, new Set());

    socket.emit('bienvenido', {
      id:     socket.id,
      nombre: config.nombre,
      color:  config.color,
    });

    console.log(`✅ ${config.nombre} (slot ${slotIndex}) conectado — slots libres: [${slotsLibres.join(', ')}]`);

    socket.on('input', (data) => {
      const inputs = inputsActivos.get(socket.id);
      if (!inputs) return;
      if (data.estado === 'presionado') inputs.add(data.direccion);
      else                              inputs.delete(data.direccion);
    });

    socket.on('disconnect', () => {
      const j = estado.jugadores.get(socket.id) as JugadorInterno | undefined;
      if (!j) return;

      console.log(`❌ ${j.nombre} desconectado`);

      // Si tenía la llave, reaparecerla
      if (j.cargandoLlave) {
        reaparecerLlave();
        io.emit('llave-reaparecio');
      }

      Matter.World.remove(motor.mundo, j.cuerpofisico);
      estado.jugadores.delete(socket.id);
      inputsActivos.delete(socket.id);

      // Devolver slot al pool, ordenado
      slotsLibres.push(j.slotIndex);
      slotsLibres.sort((a, b) => a - b);

      console.log(`   Slots libres: [${slotsLibres.join(', ')}]`);
      io.emit('jugador-desconectado', { id: socket.id, nombre: j.nombre });
    });
  });

  httpServer.listen(puerto, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${puerto}`);
  });
}

// Snapshot:
function construirSnapshot(estado: any, cuerpoLlave: Matter.Body | null) {
  return {
    fase:          estado.fase,
    nivelActual:   estado.nivelActual,
    llaveEnJuego:  estado.llaveEnJuego,
    llaveRecogida: estado.llaveRecogida,
    // posición de la llave para dibujarla en el canvas
    llaveX: estado.llaveEnJuego && cuerpoLlave ? cuerpoLlave.position.x : null,
    llaveY: estado.llaveEnJuego && cuerpoLlave ? cuerpoLlave.position.y : null,
    jugadores: [...estado.jugadores.values()].map((j: any) => ({
      id:            j.id,
      nombre:        j.nombre,
      color:         j.color,
      x:             j.cuerpofisico.position.x,
      y:             j.cuerpofisico.position.y,
      cargandoLlave: j.cargandoLlave,
    })),
  };
}