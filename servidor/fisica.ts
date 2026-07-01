import Matter from 'matter-js';
import type { Caja } from './configuracionNiveles';

const { Engine, Bodies, Body, Composite } = Matter;

export function crearMotorFisico() {
  const motor = Engine.create({
    gravity: { x: 0, y: 2 },
    positionIterations: 10,
    velocityIterations: 10,
  });
  const mundo = motor.world;
  return { motor, mundo };
}

export function crearCuerpoJugador(x: number, y: number, etiqueta: string) {
  return Bodies.rectangle(x, y, 36, 54, {
    label:          `jugador-${etiqueta}`,
    friction:       0,
    frictionStatic: 0,
    frictionAir:    0.02,
    restitution:    0,
    inertia:        Infinity,
  });
}

export function crearCuerposCajas(cajas: Caja[]): Matter.Body[] {
  return cajas.map((caja, indice) =>
    Bodies.rectangle(caja.x, caja.y, caja.ancho, caja.alto, {
      label:       `caja-${indice}`,
      friction:    0.1,
      frictionStatic: 0,        
      frictionAir: 0.05,
      restitution: 0,
      mass:        5,
      inertia:     Infinity,
      slop:        0.05, 
    })
  );
}

const FUERZA_JUGADOR = 0.022;
const VEL_MAX_X      = 7;

export function aplicarMovimiento(
  cuerpo:             Matter.Body,
  botones:            Set<string>,
  enSuelo:            boolean,
  saltoBloqueado:     boolean,
) {
  const quiereIzquierda = botones.has('izquierda');
  const quiereDerecha   = botones.has('derecha');

  if (quiereIzquierda) {
    Body.applyForce(cuerpo, cuerpo.position, { x: -FUERZA_JUGADOR, y: 0 });
  } else if (quiereDerecha) {
    Body.applyForce(cuerpo, cuerpo.position, { x: FUERZA_JUGADOR, y: 0 });
  } else {
    Body.setVelocity(cuerpo, { x: cuerpo.velocity.x * 0.6, y: cuerpo.velocity.y });
  }

  if (Math.abs(cuerpo.velocity.x) > VEL_MAX_X) {
    Body.setVelocity(cuerpo, {
      x: Math.sign(cuerpo.velocity.x) * VEL_MAX_X,
      y: cuerpo.velocity.y,
    });
  }

  const yaVaParaArriba = cuerpo.velocity.y < -0.5;
  const puedeSaltar     = enSuelo && !yaVaParaArriba && !saltoBloqueado;

  if (botones.has('salto') && puedeSaltar) {
    Body.setVelocity(cuerpo, { x: cuerpo.velocity.x, y: -15 });
  }
}

function distanciaVerticalEntreCentros(centroA: number, altoA: number, centroB: number, altoB: number): number {
  const distanciaEsperada = (altoA + altoB) / 2;
  const distanciaReal     = centroB - centroA;
  return distanciaReal - distanciaEsperada;
}

export function estaEnSuelo(cuerpo: Matter.Body, mundo: Matter.World): boolean {
  const todosCuerpos = Composite.allBodies(mundo);

  const altoCuerpo = cuerpo.bounds.max.y - cuerpo.bounds.min.y;
  const izqX = cuerpo.bounds.min.x + 4;
  const derX = cuerpo.bounds.max.x - 4;

  for (const otro of todosCuerpos) {
    if (otro === cuerpo) continue;
    if (cuerpo.parts && cuerpo.parts.includes(otro)) continue;
    if (otro.isSensor) continue; // FIX fantasma: un jugador que ya entró (sensor) no cuenta como suelo

    const esSuelo   = otro.isStatic;
    const esCaja    = otro.label?.startsWith('caja-');
    const esJugador = otro.label?.startsWith('jugador-');
    if (!esSuelo && !esCaja && !esJugador) continue;

    const izqOtro = otro.bounds.min.x;
    const derOtro = otro.bounds.max.x;
    const tocaHorizontal = derX > izqOtro && izqX < derOtro;
    if (!tocaHorizontal) continue;

    const altoOtro = otro.bounds.max.y - otro.bounds.min.y;
    const distancia = distanciaVerticalEntreCentros(cuerpo.position.y, altoCuerpo, otro.position.y, altoOtro);

    if (Math.abs(distancia) <= 14) return true;
  }

  return false;
}
export function actualizarBloqueoSalto(
  cuerpo: Matter.Body,
  mundo: Matter.World,
  bloqueadoAntes: boolean,
): boolean {
  const todosCuerpos = Composite.allBodies(mundo);

  const altoCuerpo = cuerpo.bounds.max.y - cuerpo.bounds.min.y;
  const izqX = cuerpo.bounds.min.x + 4;
  const derX = cuerpo.bounds.max.x - 4;

  let distanciaMinimaConJugadorArriba: number | null = null;

  for (const otro of todosCuerpos) {
    if (otro === cuerpo) continue;
    if (otro.isSensor) continue; // FIX fantasma: jugador que ya entró no cuenta peso

    const esJugador = otro.label?.startsWith('jugador-');
    if (!esJugador) continue;

    const izqOtro = otro.bounds.min.x;
    const derOtro = otro.bounds.max.x;
    const tocaHorizontal = derX > izqOtro && izqX < derOtro;
    if (!tocaHorizontal) continue;

    const altoOtro = otro.bounds.max.y - otro.bounds.min.y;
    const distancia = distanciaVerticalEntreCentros(otro.position.y, altoOtro, cuerpo.position.y, altoCuerpo);

    if (distancia < 0) continue; 

    if (distanciaMinimaConJugadorArriba === null || distancia < distanciaMinimaConJugadorArriba) {
      distanciaMinimaConJugadorArriba = distancia;
    }
  }

  if (distanciaMinimaConJugadorArriba === null) {
    return false;
  }

  if (distanciaMinimaConJugadorArriba <= 14) {
    return true;
  }

  if (distanciaMinimaConJugadorArriba > 40) {
    return false;
  }

  return bloqueadoAntes;
}

export function avanzarMotor(motor: Matter.Engine, deltaMs: number) {
  const PASO_MAX = 16;
  let restante = deltaMs;
  while (restante > 0) {
    Engine.update(motor, Math.min(restante, PASO_MAX));
    restante -= PASO_MAX;
  }
}