import { createServer }   from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync }   from 'fs';
import { join }           from 'path';
import Matter             from 'matter-js';

import {
  crearMotorFisico,
  crearCuerpoJugador,
  crearCuerposCajas,
  aplicarMovimiento,
  estaEnSuelo,
  avanzarMotor,
} from './fisica';

import { NIVELES } from './configuracionNiveles';

import {
  crearEstadoInicial,
  CONFIGS_JUGADORES,
  MAX_JUGADORES,
  MIN_JUGADORES_PARA_GANAR,
} from './configuracionJugadores';

import type { Jugador } from './configuracionJugadores';

// Cuántas veces por segundo se actualiza la física (60 fps)
const TICKS_POR_SEGUNDO = 60;
const MS_POR_TICK       = 1000 / TICKS_POR_SEGUNDO;


// Envía un objeto JSON a un solo cliente
function enviar(cliente: WebSocket, mensaje: object) {
  if (cliente.readyState === WebSocket.OPEN) {
    cliente.send(JSON.stringify(mensaje));
  }
}

// Envía un objeto JSON a TODOS los clientes conectados
function enviarATodos(clientes: Set<WebSocket>, mensaje: object) {
  const texto = JSON.stringify(mensaje);
  for (const cliente of clientes) {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(texto);
    }
  }
}

export function iniciarServidorWS(puerto: number, dirPagDeJuego: string, urlJuego: string) {

  //Servidor HTTP (sirve los archivos de la página)
  const servidorHttp = createServer((solicitud, respuesta) => {
    const url = solicitud.url ?? '/';

    const archivosPermitidos: Record<string, string> = {
      '/':            'index.html',
      '/index.html':  'index.html',
      '/juego.js':    'juego.js',
      '/estilos.css': 'estilos.css',
    };

    const tiposMime: Record<string, string> = {
      'index.html':  'text/html; charset=utf-8',
      'juego.js':    'application/javascript',
      'estilos.css': 'text/css',
    };

    const nombreArchivo = archivosPermitidos[url];

    if (!nombreArchivo) {
      respuesta.writeHead(404);
      respuesta.end('Página no encontrada');
      return;
    }

    try {
      const contenido = readFileSync(join(dirPagDeJuego, nombreArchivo));
      respuesta.writeHead(200, { 'Content-Type': tiposMime[nombreArchivo] });
      respuesta.end(contenido);
    } catch {
      respuesta.writeHead(500);
      respuesta.end('Error interno del servidor');
    }
  });

  //Servidor WebSocket (sobre el mismo puerto HTTP)
  const servidorWS = new WebSocketServer({ server: servidorHttp });

  //Estado global del juego 
  const estado             = crearEstadoInicial();
  const { motor, mundo }   = crearMotorFisico();
  const nivelConfig        = NIVELES[estado.nivelActual - 1];


  const botonesPorIdWS = new Map<string, Set<string>>();
  const slotsLibres: number[] = [0, 1, 2, 3];

  const todosLosClientes = new Set<WebSocket>();

  for (const plataforma of nivelConfig.plataformas) {
    Matter.World.add(
      mundo,
      Matter.Bodies.rectangle(
        plataforma.x, plataforma.y,
        plataforma.ancho, plataforma.alto,
        { isStatic: true, label: plataforma.etiqueta ?? 'plataforma' }
      )
    );
  }

  const cuerposCajas = crearCuerposCajas(nivelConfig.cajas);
  for (const caja of cuerposCajas) {
    Matter.World.add(mundo, caja);
  }

  let cuerpoLlave: Matter.Body | null = Matter.Bodies.circle(
    nivelConfig.posicionLlave.x,
    nivelConfig.posicionLlave.y,
    18,
    { isStatic: true, isSensor: true, label: 'llave' }
  );
  Matter.World.add(mundo, cuerpoLlave);

  function reaparecerLlave() {
    if (!cuerpoLlave) return;

    Matter.Body.setPosition(cuerpoLlave, {
      x: nivelConfig.posicionLlave.x,
      y: nivelConfig.posicionLlave.y,
    });

    estado.llaveEnJuego  = true;
    estado.llaveRecogida = false;

    for (const jugador of estado.jugadores.values()) {
      jugador.cargandoLlave = false;
    }
  }

  function construirSnapshot() {
    return {
      tipo:          'estado',
      fase:          estado.fase,
      nivelActual:   estado.nivelActual,
      llaveEnJuego:  estado.llaveEnJuego,
      llaveRecogida: estado.llaveRecogida,
      llaveX: estado.llaveEnJuego && cuerpoLlave ? cuerpoLlave.position.x : null,
      llaveY: estado.llaveEnJuego && cuerpoLlave ? cuerpoLlave.position.y : null,
      jugadores: [...estado.jugadores.values()].map((j: Jugador) => ({
        id:            j.id,
        nombre:        j.nombre,
        color:         j.color,
        x:             j.cuerpoFisico.position.x,
        y:             j.cuerpoFisico.position.y,
        cargandoLlave: j.cargandoLlave,
      })),
      // Cajas: posición actualizada cada tick para que el cliente las dibuje
      cajas: cuerposCajas.map(caja => ({
        x:     caja.position.x,
        y:     caja.position.y,
        ancho: nivelConfig.cajas[0]?.ancho ?? 40, // todas las cajas del nivel tienen el mismo tamaño
        alto:  nivelConfig.cajas[0]?.alto  ?? 40,
      })),
    };
  }

  let momentoUltimoTick = Date.now();

  setInterval(() => {
    const ahora       = Date.now();
    const deltaMs     = Math.min(ahora - momentoUltimoTick, 50);
    momentoUltimoTick = ahora;

for (const [idWS, jugador] of estado.jugadores.entries()) {
      const botones = botonesPorIdWS.get(idWS) ?? new Set();
      const enSuelo = estaEnSuelo(jugador.cuerpoFisico, mundo);
      aplicarMovimiento(jugador.cuerpoFisico, botones, enSuelo);
    }

    //Avanzar la simulación física
    avanzarMotor(motor, deltaMs);

    const cantidadJugadores = estado.jugadores.size;

    if (cantidadJugadores < MIN_JUGADORES_PARA_GANAR) {
      estado.llaveEnJuego = false;
    } else if (!estado.llaveEnJuego && !estado.llaveRecogida) {
      estado.llaveEnJuego = true;
    }

    //Detectar si alguien toca la llave
    if (estado.llaveEnJuego && !estado.llaveRecogida && cuerpoLlave) {
      for (const jugador of estado.jugadores.values()) {
        const distanciaX = Math.abs(jugador.cuerpoFisico.position.x - cuerpoLlave.position.x);
        const distanciaY = Math.abs(jugador.cuerpoFisico.position.y - cuerpoLlave.position.y);
        const tocaLaLlave = distanciaX < 40 && distanciaY < 50;

        if (tocaLaLlave) {
          jugador.cargandoLlave = true;
          estado.llaveRecogida  = true;
          estado.llaveEnJuego   = false;
          enviarATodos(todosLosClientes, {
            tipo:      'llave-recogida',
            jugadorId: jugador.id,
            nombre:    jugador.nombre,
          });
          console.log(`🗝️  ${jugador.nombre} agarró la llave`);
          break;
        }
      }
    }

    //Si cualquier jugador cae al vacío → respawn en su posición inicial
    for (const jugador of estado.jugadores.values()) {
      const cayoAlVacio = jugador.cuerpoFisico.position.y > nivelConfig.altoMundo + 100;
      if (!cayoAlVacio) continue;

      // Si tenía la llave, reaparecerla para que otros puedan agarrarla
      if (jugador.cargandoLlave) {
        jugador.cargandoLlave = false;
        reaparecerLlave();
        enviarATodos(todosLosClientes, { tipo: 'llave-reaparecio' });
      }

      // Volver al punto de spawn del slot de este jugador
      const spawn = nivelConfig.posicionesIniciales[jugador.slotIndex];
      Matter.Body.setPosition(jugador.cuerpoFisico, { x: spawn.x, y: spawn.y });
      Matter.Body.setVelocity(jugador.cuerpoFisico, { x: 0, y: 0 });

      console.log(`💀 ${jugador.nombre} cayó al vacío — respawn en (${spawn.x}, ${spawn.y})`);
    }
    
    //Detectar si suficientes jugadores llegaron a la puerta con la llave
    if (estado.fase === 'jugando') {
      const puerta = nivelConfig.posicionPuerta;

      const jugadoresEntrando = [...estado.jugadores.entries()].filter(([idWS, jugador]) => {
        const botones        = botonesPorIdWS.get(idWS);
        const presionaArriba = botones?.has('arriba') ?? false;

        const distanciaX    = Math.abs(jugador.cuerpoFisico.position.x - puerta.x);
        const distanciaY    = Math.abs(jugador.cuerpoFisico.position.y - puerta.y);
        const cercaDePuerta = distanciaX < 60 && distanciaY < 80;

        return presionaArriba && cercaDePuerta;
      }).map(([, jugador]) => jugador);

      const hayLlaveEnPuerta = jugadoresEntrando.some(j => j.cargandoLlave);

      if (hayLlaveEnPuerta && jugadoresEntrando.length >= MIN_JUGADORES_PARA_GANAR) {
        estado.fase = 'nivel-completado';
        enviarATodos(todosLosClientes, { tipo: 'nivel-completado', nivel: estado.nivelActual });
        console.log(`🏆 Nivel ${estado.nivelActual} completado!`);
      }
    }

    //Enviar snapshot de posiciones a todos (pantalla + gamepads)
    enviarATodos(todosLosClientes, construirSnapshot());

  }, MS_POR_TICK);

  //Manejo de conexiones WebSocket
  servidorWS.on('connection', (cliente: WebSocket) => {
    todosLosClientes.add(cliente);

    // Esperar el primer mensaje para saber si es pantalla o gamepad
    cliente.once('message', (mensajeRaw: Buffer) => {
      let mensaje: any;

      try {
        mensaje = JSON.parse(mensajeRaw.toString());
      } catch {
        cliente.close();
        return;
      }

      //Pantalla del juego
      if (mensaje.tipo === 'pantalla') {
        console.log('🖥️  Pantalla conectada');
        // Enviar la URL del servidor a la pantalla para mostrar el QR
        enviar(cliente, { tipo: 'info-servidor', urlJuego });

        cliente.on('close', () => {
          todosLosClientes.delete(cliente);
          console.log('🖥️  Pantalla desconectada');
        });
        return;
      }

      //Gamepad (jugador)
      if (slotsLibres.length === 0) {
        enviar(cliente, { tipo: 'partida-llena' });
        cliente.close();
        console.log('🚫 Partida llena — conexión rechazada');
        return;
      }

      //Asignar slot y crear jugador
      const slotIndex  = slotsLibres.shift()!;
      const configSlot = CONFIGS_JUGADORES[slotIndex];
      const spawn      = nivelConfig.posicionesIniciales[slotIndex];
      const cuerpo     = crearCuerpoJugador(spawn.x, spawn.y, slotIndex.toString());

      Matter.World.add(mundo, cuerpo);

      // idWS: clave interna que usamos en los mapas del servidor
      // id:   lo que se le manda al gamepad (mismo valor, más claro)
      const idWS = `ws-${slotIndex}`;

      const jugador: Jugador = {
        id:            idWS,   
        nombre:        configSlot.nombre,
        color:         configSlot.color,
        cuerpoFisico:  cuerpo,
        cargandoLlave: false,
        slotIndex,
      };

      estado.jugadores.set(idWS, jugador);
      botonesPorIdWS.set(idWS, new Set());

      // Avisar al gamepad sus datos personales
      enviar(cliente, {
        tipo:   'bienvenido',
        id:     idWS,
        nombre: configSlot.nombre,
        color:  configSlot.color,
      });

      estado.fase = 'jugando';

      console.log(`✅ ${configSlot.nombre} (slot ${slotIndex}) conectado — total: ${estado.jugadores.size}`);

      //Recibir botones del gamepad
      cliente.on('message', (rawInput: Buffer) => {
        let input: any;
        try {
          input = JSON.parse(rawInput.toString());
        } catch {
          return;
        }

        if (input.tipo !== 'input') return;

        //Buscar los botones de ESTE jugador usando idWS
        const botones = botonesPorIdWS.get(idWS);
        if (!botones) return;

        if (input.estado === 'presionado') {
          botones.add(input.direccion);
        } else {
          botones.delete(input.direccion);
        }
      });

      //Desconexión del jugador
      cliente.on('close', () => {
        todosLosClientes.delete(cliente);

        const jugadorQueSeVa = estado.jugadores.get(idWS);
        if (!jugadorQueSeVa) return;

        console.log(`❌ ${jugadorQueSeVa.nombre} desconectado`);

        // Si tenía la llave, reaparecerla para los demás
        if (jugadorQueSeVa.cargandoLlave) {
          reaparecerLlave();
          enviarATodos(todosLosClientes, { tipo: 'llave-reaparecio' });
        }

        // Limpiar cuerpo físico y estado
        Matter.World.remove(mundo, jugadorQueSeVa.cuerpoFisico);
        estado.jugadores.delete(idWS);
        botonesPorIdWS.delete(idWS);

        // Devolver slot al pool para que otro jugador pueda usarlo
        slotsLibres.push(slotIndex);
        slotsLibres.sort((a, b) => a - b);

        // Si quedan 0 jugadores, volver a esperar
        if (estado.jugadores.size === 0) {
          estado.fase = 'esperando';
        }

        enviarATodos(todosLosClientes, {
          tipo:   'jugador-salio',
          id:     idWS,
          nombre: jugadorQueSeVa.nombre,
        });
      });
    });

    // Si el cliente cierra antes de identificarse
    cliente.on('close', () => {
      todosLosClientes.delete(cliente);
    });
  });

  servidorHttp.listen(puerto, '0.0.0.0', () => {
    console.log(`✅ Servidor escuchando en puerto ${puerto}`);
  });
}