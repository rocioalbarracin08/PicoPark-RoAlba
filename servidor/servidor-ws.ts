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
} from './motor';

import { NIVELES } from './niveles';

import {
  crearEstadoInicial,
  CONFIGS_JUGADORES,
  MAX_JUGADORES,
  MIN_PARA_GANAR,
} from './tipos';

const TICK_RATE = 1000 / 60;

export function iniciarServidorWS(
  puerto: number,
  dirPagDeJuego: string,
) {

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

    if (!archivo) {
      res.writeHead(404);
      res.end('404');
      return;
    }

    try {
      const contenido = readFileSync(join(dirPagDeJuego, archivo));
      res.writeHead(200, { 'Content-Type': tipos[archivo] });
      res.end(contenido);
    } catch {
      res.writeHead(500);
      res.end('error');
    }
  });

  const io = new IOServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  const estado = crearEstadoInicial();
  const motor  = crearMotorFisico();
  const nivel  = NIVELES[0];

  for (const p of nivel.plataformas) {
    const plataforma = Matter.Bodies.rectangle(p.x, p.y, p.ancho, p.alto, {
      isStatic: true,
      label: p.etiqueta ?? 'plataforma',
    });
    Matter.World.add(motor.mundo, plataforma);
  }

  const inputsActivos = new Map<string, Set<string>>();

  // Pool de slots de color
  const slotsLibres: number[] = [0, 1, 2, 3];

  //  Game loop
  let ultimoTick = Date.now();

  setInterval(() => {
    const ahora = Date.now();
    const delta = Math.min(ahora - ultimoTick, 50); // máx 50ms para evitar saltos físicos
    ultimoTick  = ahora;

    for (const jugador of estado.jugadores.values()) {
      const inputs  = inputsActivos.get(jugador.id) ?? new Set();
      const enSuelo = estaEnSuelo(jugador.cuerpofisico, motor.motor);
      aplicarMovimiento(jugador.cuerpofisico, inputs, enSuelo);
    }

    avanzarMotor(motor.motor, delta);

    // La llave aparece cuando hay suficientes jugadores
    estado.llaveEnJuego = estado.jugadores.size >= MIN_PARA_GANAR;

    verificarVictoria(estado, motor, nivel, io);

    io.emit('estado', construirSnapshot(estado));

  }, TICK_RATE);

  io.on('connection', (socket: Socket) => {
    const tipo = socket.handshake.query.tipo;

    if (tipo === 'pantalla') {
      console.log('🖥️ Pantalla conectada');
      socket.on('disconnect', (r) => console.log(`🖥️ Pantalla desconectada (${r})`));
      return;
    }

    // Gamepad: verificar si hay slots disponibles
    if (slotsLibres.length === 0) {
      socket.emit('partida-llena'); 
      socket.disconnect();
      console.log(`🚫 Partida llena — rechazado (${socket.id})`);
      return;
    }

    // Tomar el slot disponible
    const slotIndex = slotsLibres.shift()!;
    const config    = CONFIGS_JUGADORES[slotIndex];
    const spawn     = nivel.posicionesIniciales[slotIndex];

    const cuerpo = crearCuerpoJugador(spawn.x, spawn.y, socket.id);
    Matter.World.add(motor.mundo, cuerpo);

    estado.jugadores.set(socket.id, {
      id:            socket.id,
      nombre:        config.nombre,
      color:         config.color,
      cuerpofisico:  cuerpo,
      conectado:     true,
      cargandoLlave: false,
      slotIndex,       
    } as any);

    inputsActivos.set(socket.id, new Set());

    socket.emit('bienvenido', {
      id:     socket.id,
      nombre: config.nombre,
      color:  config.color,
    });

    console.log(`✅ ${config.nombre} conectado — N* de jugador disponible: [${slotsLibres.join(', ')}]`);

    // Inputs del gamepad
    socket.on('input', (data) => {
      const inputs = inputsActivos.get(socket.id);
      if (!inputs) return;
      if (data.estado === 'presionado') {
        inputs.add(data.direccion);
      } else {
        inputs.delete(data.direccion);
      }
    });

    // Desconexión: liberar slot y limpiar
    socket.on('disconnect', () => {
      const jugador = estado.jugadores.get(socket.id) as any;
      if (!jugador) return;

      console.log(`❌ ${jugador.nombre} desconectado`);

      Matter.World.remove(motor.mundo, jugador.cuerpofisico);
      estado.jugadores.delete(socket.id);
      inputsActivos.delete(socket.id);

      slotsLibres.push(jugador.slotIndex);
      slotsLibres.sort((a, b) => a - b);

      console.log(`   Slots libres ahora: [${slotsLibres.join(', ')}]`);

      io.emit('jugador-desconectado', { id: socket.id, nombre: jugador.nombre });
    });
  });

  httpServer.listen(puerto, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${puerto}`);
  });
}

// Victoria 
function verificarVictoria(
  estado: any,
  motor:  any,
  nivel:  any,
  io:     IOServer,
) {
  if (!estado.llaveEnJuego) return;
  if (estado.fase === 'nivel-completado') return;

  const puerta    = nivel.posicionPuerta;
  const jugadores = [...estado.jugadores.values()];

  const enSalida = jugadores.filter((j: any) => {
    const dx = Math.abs(j.cuerpofisico.position.x - puerta.x);
    const dy = Math.abs(j.cuerpofisico.position.y - puerta.y);
    return dx < 80 && dy < 80;
  });

  if (enSalida.length >= MIN_PARA_GANAR) {
    estado.fase = 'nivel-completado';
    io.emit('nivel-completado', { nivel: estado.nivelActual });
    console.log('🎉 Nivel completado!');
  }
}

// Snapshot para el cliente 
function construirSnapshot(estado: any) {
  return {
    fase:          estado.fase,
    nivelActual:   estado.nivelActual,
    llaveEnJuego:  estado.llaveEnJuego,
    llaveRecogida: estado.llaveRecogida,
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