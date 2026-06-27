import Matter from 'matter-js';

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

//Tipos exportados para que conexionRed.ts pueda usarlos 
export type EnviarATodosFn = (mensaje: object) => void;

//Estado global de la simulación 
const estado           = crearEstadoInicial();
const { motor, mundo } = crearMotorFisico();
const nivelConfig      = NIVELES[estado.nivelActual - 1];

export const slotsLibres: number[] = Array.from({ length: MAX_JUGADORES }, (_, i) => i);

const botonesPorIdWS = new Map<string, Set<string>>();

// ── Física del nivel: plataformas, cajas, llave ─────────────────────────────
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
for (const caja of cuerposCajas) Matter.World.add(mundo, caja);

let cuerpoLlave: Matter.Body | null = Matter.Bodies.circle(
  nivelConfig.posicionLlave.x,
  nivelConfig.posicionLlave.y,
  18,
  { isStatic: true, isSensor: true, label: 'llave' }
);
Matter.World.add(mundo, cuerpoLlave);

// ── Helpers internos ─────────────────────────────────────────────────────────
function reaparecerLlave(enviarATodos: EnviarATodosFn) {
  if (!cuerpoLlave) return;
  Matter.Body.setPosition(cuerpoLlave, {
    x: nivelConfig.posicionLlave.x,
    y: nivelConfig.posicionLlave.y,
  });
  estado.llaveEnJuego  = true;
  estado.llaveRecogida = false;
  for (const jugador of estado.jugadores.values()) jugador.cargandoLlave = false;
  enviarATodos({ tipo: 'llave-reaparecio' });
}

function construirSnapshot() {
  return {
    tipo:          'estado',
    fase:          estado.fase,
    nivelActual:   estado.nivelActual,
    minJugadores:  MIN_JUGADORES_PARA_GANAR,
    maxJugadores:  MAX_JUGADORES, 
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
    cajas: cuerposCajas.map(caja => ({
      x:     caja.position.x,
      y:     caja.position.y,
      ancho: nivelConfig.cajas[0]?.ancho ?? 40,
      alto:  nivelConfig.cajas[0]?.alto  ?? 40,
    })),
  };
}

// ── API pública: lo que conexionRed.ts llama ─────────────────────────────────

export function registrarJugador(idWS: string): { nombre: string; color: string; slotIndex: number } | null {
  if (slotsLibres.length === 0) return null;

  const slotIndex  = slotsLibres.shift()!;
  const configSlot = CONFIGS_JUGADORES[slotIndex];
  const spawn      = nivelConfig.posicionesIniciales[slotIndex];
  const cuerpo     = crearCuerpoJugador(spawn.x, spawn.y, slotIndex.toString());

  Matter.World.add(mundo, cuerpo);

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
  estado.fase = 'jugando';

  return { nombre: configSlot.nombre, color: configSlot.color, slotIndex };
}

export function desregistrarJugador(idWS: string, enviarATodos: EnviarATodosFn) {
  const jugador = estado.jugadores.get(idWS);
  if (!jugador) return;

  console.log(`❌ ${jugador.nombre} desconectado`);

  if (jugador.cargandoLlave) reaparecerLlave(enviarATodos);

  Matter.World.remove(mundo, jugador.cuerpoFisico);
  estado.jugadores.delete(idWS);
  botonesPorIdWS.delete(idWS);

  slotsLibres.push(jugador.slotIndex);
  slotsLibres.sort((a, b) => a - b);

  if (estado.jugadores.size === 0) estado.fase = 'esperando';

  enviarATodos({ tipo: 'jugador-salio', id: idWS, nombre: jugador.nombre });
}

export function registrarInput(idWS: string, direccion: string, accion: 'presionado' | 'soltado') {
  const botones = botonesPorIdWS.get(idWS);
  if (!botones) return;
  if (accion === 'presionado') botones.add(direccion);
  else                         botones.delete(direccion);
}

export function hayLugar(): boolean {
  return slotsLibres.length > 0;
}

// ── Tick loop a 60fps ────────────────────────────────────────────────────────
const MS_POR_TICK = 1000 / 60;
let momentoUltimoTick = Date.now();

export function iniciarSimulacion(enviarATodos: EnviarATodosFn) {
  setInterval(() => {
    const ahora   = Date.now();
    const deltaMs = Math.min(ahora - momentoUltimoTick, 50);
    momentoUltimoTick = ahora;

    for (const [idWS, jugador] of estado.jugadores.entries()) {
      const botones = botonesPorIdWS.get(idWS) ?? new Set();
      aplicarMovimiento(jugador.cuerpoFisico, botones, estaEnSuelo(jugador.cuerpoFisico, mundo));
    }

    avanzarMotor(motor, deltaMs);

    // Llave: aparece solo con suficientes jugadores
    const cantJugadores = estado.jugadores.size;
    if (cantJugadores < MIN_JUGADORES_PARA_GANAR) {
      estado.llaveEnJuego = false;
    } else if (!estado.llaveEnJuego && !estado.llaveRecogida) {
      estado.llaveEnJuego = true;
    }

    // Detectar si alguien toca la llave
    if (estado.llaveEnJuego && !estado.llaveRecogida && cuerpoLlave) {
      for (const jugador of estado.jugadores.values()) {
        const dx = Math.abs(jugador.cuerpoFisico.position.x - cuerpoLlave.position.x);
        const dy = Math.abs(jugador.cuerpoFisico.position.y - cuerpoLlave.position.y);
        if (dx < 40 && dy < 50) {
          jugador.cargandoLlave = true;
          estado.llaveRecogida  = true;
          estado.llaveEnJuego   = false;
          enviarATodos({ tipo: 'llave-recogida', jugadorId: jugador.id, nombre: jugador.nombre });
          console.log(`🗝️  ${jugador.nombre} agarró la llave`);
          break;
        }
      }
    }

    // Respawn si cae al vacío
    for (const jugador of estado.jugadores.values()) {
      if (jugador.cuerpoFisico.position.y <= nivelConfig.altoMundo + 100) continue;
      if (jugador.cargandoLlave) reaparecerLlave(enviarATodos);
      const spawn = nivelConfig.posicionesIniciales[jugador.slotIndex];
      Matter.Body.setPosition(jugador.cuerpoFisico, { x: spawn.x, y: spawn.y });
      Matter.Body.setVelocity(jugador.cuerpoFisico, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(jugador.cuerpoFisico, 0);
    }

    // Detectar nivel completado
    if (estado.fase === 'jugando') {
      const puerta = nivelConfig.posicionPuerta;
      const entrando = [...estado.jugadores.entries()].filter(([idWS, jugador]) => {
        const botones       = botonesPorIdWS.get(idWS);
        const presionaArriba = botones?.has('arriba') ?? false;
        const dx = Math.abs(jugador.cuerpoFisico.position.x - puerta.x);
        const dy = Math.abs(jugador.cuerpoFisico.position.y - puerta.y);
        return presionaArriba && dx < 60 && dy < 80;
      }).map(([, j]) => j);

      if (entrando.some(j => j.cargandoLlave) && entrando.length >= MIN_JUGADORES_PARA_GANAR) {
        estado.fase = 'nivel-completado';
        enviarATodos({ tipo: 'nivel-completado', nivel: estado.nivelActual });
        console.log(`🏆 Nivel ${estado.nivelActual} completado!`);
      }
    }

    enviarATodos(construirSnapshot());
  }, MS_POR_TICK);
}