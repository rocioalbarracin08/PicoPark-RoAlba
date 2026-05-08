import { WebSocketServer, WebSocket } from 'ws';
import type { EstadoJuego } from './tipos.ts';
import {
  CONFIGS_JUGADORES,
  MAX_JUGADORES,
  crearEstadoInicial,
} from './tipos.ts';
import {
  crearMotorFisico,
  crearCuerpoJugador,
  aplicarMovimiento,
  estaEnSuelo,
} from './motor.ts';
import { NIVELES } from './niveles.ts';
import Matter from 'matter-js';

// Tipos de mensajes que puede enviar el celular
type TipoInput = 'izquierda' | 'derecha' | 'salto' | 'ninguna';

interface MensajeInput {
  tipo: 'input';
  direccion: TipoInput;
  estado: 'presionado' | 'soltado';
}

// El estado de teclas de cada jugador (qué está apretando ahora mismo)
const inputsActivos = new Map<string, Set<TipoInput>>();

export function iniciarServidorWS(puerto: number) {
  const wss = new WebSocketServer({ port: puerto });
  const estado: EstadoJuego = crearEstadoInicial();

  // Cargamos el nivel 1 al inicio
  let motorActual = crearMotorFisico(NIVELES[0], () => {});

  console.log(`Servidor WebSocket corriendo en puerto ${puerto}`);

  // Este loop procesa física y envía estado a todos los clientes
  setInterval(() => {
    if (estado.fase !== 'jugando') return;

    procesarInputs(estado, motorActual.motor);
    verificarColisiones(estado, motorActual);
    enviarEstadoATodos(wss, estado);
  }, 1000 / 30); 

  wss.on('connection', (socket: WebSocket) => {
    const idSocket = generarId();

    const jugadoresConectados = [...estado.jugadores.values()].filter(j => j.conectado);
    if (jugadoresConectados.length >= MAX_JUGADORES) {
      socket.send(JSON.stringify({ tipo: 'error', mensaje: 'Juego lleno (máximo 4 jugadores)' }));
      socket.close();
      return;
    }

    // Asignar color y nombre automáticamente
    const indice = estado.jugadores.size % CONFIGS_JUGADORES.length;
    const config  = CONFIGS_JUGADORES[indice];

    // Crear cuerpo físico para este jugador
    const nivel      = NIVELES[estado.nivelActual - 1];
    const posInicial = nivel.posicionesIniciales[indice];
    const cuerpo     = crearCuerpoJugador(posInicial.x, posInicial.y, idSocket);
    Matter.World.add(motorActual.mundo, cuerpo);

    // Registrar jugador en el estado
    estado.jugadores.set(idSocket, {
      id:             idSocket,
      nombre:         config.nombre,
      color:          config.color,
      cuerpofisico:   cuerpo,
      cargandoLlave:  false,
      conectado:      true,
    });

    inputsActivos.set(idSocket, new Set());

    console.log(`${config.nombre} conectado (ID: ${idSocket})`);

    // Confirmar conexión al celular
    socket.send(JSON.stringify({
      tipo:   'bienvenida',
      id:     idSocket,
      nombre: config.nombre,
      color:  config.color,
    }));

    // Si ya hay 4 jugadores, empezar el juego
    if ([...estado.jugadores.values()].filter(j => j.conectado).length === MAX_JUGADORES) {
      estado.fase = 'jugando';
      broadcast(wss, { tipo: 'juego-inicio', nivel: estado.nivelActual });
    } else {
      broadcast(wss, {
        tipo:              'lobby-actualizado',
        jugadoresConectados: contarJugadores(estado),
        esperando:         MAX_JUGADORES - contarJugadores(estado),
      });
    }

    socket.on('message', (datos: Buffer) => {
      try {
        const mensaje: MensajeInput = JSON.parse(datos.toString());
        if (mensaje.tipo !== 'input') return;

        const inputs = inputsActivos.get(idSocket);
        if (!inputs) return;

        if (mensaje.estado === 'presionado') {
          inputs.add(mensaje.direccion);
        } else {
          inputs.delete(mensaje.direccion);
        }
      } catch {
        // Ignorar mensajes malformados 
      }
    });

    socket.on('close', () => {
      const jugador = estado.jugadores.get(idSocket);
      if (jugador) {
        jugador.conectado = false;
        Matter.World.remove(motorActual.mundo, jugador.cuerpofisico);

        // Si llevaba la llave, reaparece la llave
        if (jugador.cargandoLlave) {
          jugador.cargandoLlave  = false;
          estado.llaveEnJuego    = true;
          estado.llaveRecogida   = false;
          reaparecerLlave(motorActual);
        }

        console.log(` ${jugador.nombre} desconectado`);
        broadcast(wss, {
          tipo:    'jugador-desconectado',
          id:      idSocket,
          nombre:  jugador.nombre,
        });
      }

      inputsActivos.delete(idSocket);
    });
  });

  return wss;
}

function procesarInputs(estado: EstadoJuego, motor: Matter.Engine): void {
  for (const [id, jugador] of estado.jugadores) {
    if (!jugador.conectado) continue;

    const inputs    = inputsActivos.get(id) ?? new Set();
    const enSuelo   = estaEnSuelo(jugador.cuerpofisico, motor);
    let   direccion: 'izquierda' | 'derecha' | 'salto' | 'ninguna' = 'ninguna';

    if (inputs.has('izquierda'))  direccion = 'izquierda';
    if (inputs.has('derecha'))    direccion = 'derecha';
    if (inputs.has('salto'))      direccion = 'salto';

    aplicarMovimiento(jugador.cuerpofisico, direccion, enSuelo);
  }
}

function verificarColisiones(estado: EstadoJuego, motor: MotorFisico): void {
  for (const jugador of estado.jugadores.values()) {
    if (!jugador.conectado) continue;

    const pos = jugador.cuerpofisico.position;

    // ¿Recogió la llave?
    if (estado.llaveEnJuego && !estado.llaveRecogida && motor.cuerpoLlave) {
      const posLlave = motor.cuerpoLlave.position;
      const distancia = Math.hypot(pos.x - posLlave.x, pos.y - posLlave.y);
      if (distancia < 40) {
        jugador.cargandoLlave = true;
        estado.llaveRecogida  = true;
        estado.llaveEnJuego   = false;
        Matter.World.remove(motor.mundo, motor.cuerpoLlave!);
      }
    }

    // ¿El que lleva la llave cayó al vacío?
    const nivel = NIVELES[estado.nivelActual - 1];
    if (jugador.cargandoLlave && pos.y > nivel.altoMundo + 50) {
      jugador.cargandoLlave = false;
      estado.llaveRecogida  = false;
      estado.llaveEnJuego   = true;
      reaparecerLlave(motor);
    }
  }

  // ¿Todos en la puerta con la llave?
  if (estado.llaveRecogida) {
    verificarCondicionVictoria(estado, motor);
  }
}

function verificarCondicionVictoria(estado: EstadoJuego, motor: MotorFisico): void {
  const puerta = motor.cuerposPuerta[0];
  if (!puerta) return;

  const todosEnPuerta = [...estado.jugadores.values()]
    .filter(j => j.conectado)
    .every(j => {
      const pos = j.cuerpofisico.position;
      return Matter.Bounds.contains(puerta.bounds, pos);
    });

  if (todosEnPuerta) {
    estado.fase = 'nivel-completado';
  }
}

function reaparecerLlave(motor: MotorFisico): void {
  // Volver a crear la llave en su posición original
  // (en una versión más completa, se haría desde niveles.ts)
}

function enviarEstadoATodos(wss: WebSocketServer, estado: EstadoJuego): void {
  const snapshot = {
    tipo:      'estado',
    fase:      estado.fase,
    jugadores: [...estado.jugadores.values()].map(j => ({
      id:            j.id,
      nombre:        j.nombre,
      color:         j.color,
      x:             j.cuerpofisico.position.x,
      y:             j.cuerpofisico.position.y,
      cargandoLlave: j.cargandoLlave,
      conectado:     j.conectado,
    })),
    llaveEnJuego:  estado.llaveEnJuego,
    llaveRecogida: estado.llaveRecogida,
  };

  broadcast(wss, snapshot);
}

function broadcast(wss: WebSocketServer, datos: object): void {
  const mensaje = JSON.stringify(datos);
  wss.clients.forEach((cliente) => {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(mensaje);
    }
  });
}

function contarJugadores(estado: EstadoJuego): number {
  return [...estado.jugadores.values()].filter(j => j.conectado).length;
}

function generarId(): string {
  return Math.random().toString(36).slice(2, 9);
}