import Matter from 'matter-js';

import {
  crearMotorFisico,
  crearCuerpoJugador,
  crearCuerposCajas,
  aplicarMovimiento,
  estaEnSuelo,
  actualizarBloqueoSalto,
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

export type EnviarATodosFn = (mensaje: object) => void;

let estado      = crearEstadoInicial();
let nivelIdx    = 0;
let nivelConfig = NIVELES[nivelIdx];
let { motor, mundo } = crearMotorFisico();

export const slotsLibres: number[] = Array.from({ length: MAX_JUGADORES }, (_, i) => i);

const botonesPorIdWS = new Map<string, Set<string>>();
const arribaAnteriorPorIdWS = new Map<string, boolean>();

const saltoBloqueadoPorIdWS = new Map<string, boolean>();

interface ProgresoSlot {
  cargandoLlave: boolean;
  yaEntro:       boolean;
}
const progresoPorSlot = new Map<number, ProgresoSlot>();

let cuerposCajas: Matter.Body[] = [];
let cuerpoLlave: Matter.Body | null = null;

function construirNivel() {
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

  cuerposCajas = crearCuerposCajas(nivelConfig.cajas);
  for (const caja of cuerposCajas) Matter.World.add(mundo, caja);

  cuerpoLlave = Matter.Bodies.circle(
    nivelConfig.posicionLlave.x,
    nivelConfig.posicionLlave.y,
    18,
    { isStatic: true, isSensor: true, label: 'llave' }
  );
  Matter.World.add(mundo, cuerpoLlave);
}
construirNivel();

function cargarSiguienteNivel(enviarATodos: EnviarATodosFn) {
  nivelIdx    = (nivelIdx + 1) % NIVELES.length;
  nivelConfig = NIVELES[nivelIdx];

  Matter.World.clear(mundo, false);
  Matter.Engine.clear(motor);
  const nuevo = crearMotorFisico();
  motor = nuevo.motor;
  mundo = nuevo.mundo;

  construirNivel();

  let i = 0;
  for (const jugador of estado.jugadores.values()) {
    const spawn = nivelConfig.posicionesIniciales[i % nivelConfig.posicionesIniciales.length];

    jugador.cuerpoFisico.isSensor = false;

    Matter.World.add(mundo, jugador.cuerpoFisico);
    Matter.Body.setPosition(jugador.cuerpoFisico, { x: spawn.x, y: spawn.y });
    Matter.Body.setVelocity(jugador.cuerpoFisico, { x: 0, y: 0 });
    jugador.cargandoLlave = false;
    jugador.yaEntro       = false;
    saltoBloqueadoPorIdWS.set(jugador.id, false);
    i++;
  }

  progresoPorSlot.clear();

  estado.fase          = 'jugando';
  estado.llaveRecogida = false;
  estado.llaveEnJuego  = estado.jugadores.size >= MIN_JUGADORES_PARA_GANAR;
  estado.puertaAbierta = false;
  estado.nivelActual   = nivelConfig.numero;

  enviarATodos({ tipo: 'nivel-nuevo', nivel: nivelConfig.numero, nombre: nivelConfig.nombre });
  console.log(`➡️  Nivel ${nivelConfig.numero}: ${nivelConfig.nombre}`);
}

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
    puertaAbierta: estado.puertaAbierta,
    llaveX: estado.llaveEnJuego && cuerpoLlave ? cuerpoLlave.position.x : null,
    llaveY: estado.llaveEnJuego && cuerpoLlave ? cuerpoLlave.position.y : null,
    jugadores: [...estado.jugadores.values()].map((j: Jugador) => ({
      id:            j.id,
      nombre:        j.nombre,
      color:         j.color,
      x:             j.cuerpoFisico.position.x,
      y:             j.cuerpoFisico.position.y,
      cargandoLlave: j.cargandoLlave,
      yaEntro:       j.yaEntro,
    })),
    cajas: cuerposCajas.map(caja => ({
      x:     caja.position.x,
      y:     caja.position.y,
      ancho: nivelConfig.cajas[0]?.ancho ?? 40,
      alto:  nivelConfig.cajas[0]?.alto  ?? 40,
    })),
  };
}


export function registrarJugador(idWS: string): { nombre: string; color: string; slotIndex: number } | null {
  if (slotsLibres.length === 0) return null;

  const slotIndex  = slotsLibres.shift()!;
  const configSlot = CONFIGS_JUGADORES[slotIndex];
  const spawn      = nivelConfig.posicionesIniciales[slotIndex];
  const cuerpo     = crearCuerpoJugador(spawn.x, spawn.y, slotIndex.toString());

  Matter.World.add(mundo, cuerpo);

  const progresoPrevio = progresoPorSlot.get(slotIndex);
  const cargandoLlave  = progresoPrevio?.cargandoLlave ?? false;
  const yaEntro         = progresoPrevio?.yaEntro ?? false;

  cuerpo.isSensor = yaEntro;

  const jugador: Jugador = {
    id:            idWS,
    nombre:        configSlot.nombre,
    color:         configSlot.color,
    cuerpoFisico:  cuerpo,
    cargandoLlave,
    slotIndex,
    yaEntro,
  };

  estado.jugadores.set(idWS, jugador);
  botonesPorIdWS.set(idWS, new Set());
  arribaAnteriorPorIdWS.set(idWS, false);
  saltoBloqueadoPorIdWS.set(idWS, false);
  estado.fase = 'jugando';

  progresoPorSlot.delete(slotIndex); 

  return { nombre: configSlot.nombre, color: configSlot.color, slotIndex };
}

export function desregistrarJugador(idWS: string, enviarATodos: EnviarATodosFn) {
  const jugador = estado.jugadores.get(idWS);
  if (!jugador) return;

  console.log(`❌ ${jugador.nombre} desconectado`);

  if (jugador.cargandoLlave && !jugador.yaEntro) reaparecerLlave(enviarATodos);

  progresoPorSlot.set(jugador.slotIndex, {
    cargandoLlave: jugador.cargandoLlave,
    yaEntro:       jugador.yaEntro,
  });

  Matter.World.remove(mundo, jugador.cuerpoFisico);
  estado.jugadores.delete(idWS);
  botonesPorIdWS.delete(idWS);
  arribaAnteriorPorIdWS.delete(idWS);
  saltoBloqueadoPorIdWS.delete(idWS);

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

const MS_POR_TICK = 1000 / 60;
let momentoUltimoTick = Date.now();

export function iniciarSimulacion(enviarATodos: EnviarATodosFn) {
  setInterval(() => {
    const ahora   = Date.now();
    const deltaMs = Math.min(ahora - momentoUltimoTick, 50);
    momentoUltimoTick = ahora;

    for (const [idWS, jugador] of estado.jugadores.entries()) {
      if (jugador.yaEntro) continue;

      const botones = botonesPorIdWS.get(idWS) ?? new Set();
      const enSuelo = estaEnSuelo(jugador.cuerpoFisico, mundo);

      const bloqueadoAntes = saltoBloqueadoPorIdWS.get(idWS) ?? false;
      const bloqueadoAhora = actualizarBloqueoSalto(jugador.cuerpoFisico, mundo, bloqueadoAntes);
      saltoBloqueadoPorIdWS.set(idWS, bloqueadoAhora);

      aplicarMovimiento(jugador.cuerpoFisico, botones, enSuelo, bloqueadoAhora);
    }

    avanzarMotor(motor, deltaMs);

    const cantJugadores = estado.jugadores.size;
    if (cantJugadores < MIN_JUGADORES_PARA_GANAR) {
      estado.llaveEnJuego = false;
    } else if (!estado.llaveEnJuego && !estado.llaveRecogida) {
      estado.llaveEnJuego = true;
    }

    if (estado.llaveEnJuego && !estado.llaveRecogida && cuerpoLlave) {
      for (const jugador of estado.jugadores.values()) {
        if (jugador.yaEntro) continue;
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

    for (const jugador of estado.jugadores.values()) {
      if (jugador.yaEntro) continue;
      if (jugador.cuerpoFisico.position.y <= nivelConfig.altoMundo + 100) continue;
      if (jugador.cargandoLlave) reaparecerLlave(enviarATodos);
      const spawn = nivelConfig.posicionesIniciales[jugador.slotIndex];
      Matter.Body.setPosition(jugador.cuerpoFisico, { x: spawn.x, y: spawn.y });
      Matter.Body.setVelocity(jugador.cuerpoFisico, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(jugador.cuerpoFisico, 0);
    }

    if (estado.fase === 'jugando') {
      const puerta = nivelConfig.posicionPuerta;

      for (const [idWS, jugador] of estado.jugadores.entries()) {
        if (jugador.yaEntro) continue; // ya no procesa nada, está fuera de juego

        const botones        = botonesPorIdWS.get(idWS);
        const arribaAhora     = botones?.has('arriba') ?? false;
        const arribaAntes     = arribaAnteriorPorIdWS.get(idWS) ?? false;
        const clickArriba     = arribaAhora && !arribaAntes;
        arribaAnteriorPorIdWS.set(idWS, arribaAhora);

        if (!clickArriba) continue;

        const dx = Math.abs(jugador.cuerpoFisico.position.x - puerta.x);
        const dy = Math.abs(jugador.cuerpoFisico.position.y - puerta.y);
        const cercaDePuerta = dx < 60 && dy < 80;
        if (!cercaDePuerta) continue;

        if (!estado.puertaAbierta) {
          if (jugador.cargandoLlave) {
            estado.puertaAbierta = true;
            enviarATodos({ tipo: 'puerta-abierta', nombre: jugador.nombre });
            console.log(`🔓 ${jugador.nombre} abrió la puerta`);
          }
          continue;
        }

        jugador.yaEntro = true;
        jugador.cuerpoFisico.isSensor = true;
        Matter.Body.setVelocity(jugador.cuerpoFisico, { x: 0, y: 0 });

        enviarATodos({ tipo: 'jugador-entro', nombre: jugador.nombre });
        console.log(`🚪 ${jugador.nombre} entró por la puerta`);
      }

      const todosEntraron =
        estado.jugadores.size > 0 &&
        [...estado.jugadores.values()].every(j => j.yaEntro);

      if (todosEntraron) {
        estado.fase = 'nivel-completado';
        enviarATodos({ tipo: 'nivel-completado', nivel: estado.nivelActual });
        console.log(`🏆 Nivel ${estado.nivelActual} completado!`);

        setTimeout(() => cargarSiguienteNivel(enviarATodos), 3000);
      }
    }

    enviarATodos(construirSnapshot());
  }, MS_POR_TICK);
}