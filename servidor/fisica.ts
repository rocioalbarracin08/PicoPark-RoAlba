import Matter from 'matter-js';
import type { Caja } from './configuracionNiveles';

const { Engine, Bodies, Body, Composite } = Matter;

export function crearMotorFisico() {
  const motor = Engine.create({
    gravity: { x: 0, y: 2 },  
  });
  const mundo = motor.world;
  return { motor, mundo };
}

export function crearCuerpoJugador(x: number, y: number, etiqueta: string) {
  return Bodies.rectangle(x, y, 36, 54, {
    label:       `jugador-${etiqueta}`,
    friction:    0.1,
    frictionAir: 0.02,
    restitution: 0,      // sin rebote al aterrizar
    inertia:     Infinity,
  });
}

export function crearCuerposCajas(cajas: Caja[]): Matter.Body[] {
  return cajas.map((caja, indice) =>
    Bodies.rectangle(caja.x, caja.y, caja.ancho, caja.alto, {
      label:       `caja-${indice}`,
      friction:    0.8,   
      frictionAir: 0.05,
      restitution: 0.1,
      mass:        5,     
      inertia:     Infinity, // no rota al ser empujada
    })
  );
}

export function aplicarMovimiento(
  cuerpo:  Matter.Body,
  botones: Set<string>,
  enSuelo: boolean,
) {
  const quiereIzquierda = botones.has('izquierda');
  const quiereDerecha   = botones.has('derecha');
  const quiereSaltar    = botones.has('salto');

  // Velocidad horizontal: –7 izquierda, +7 derecha, 0 quieto
  let velocidadX = 0;
  if (quiereIzquierda) velocidadX = -7;
  if (quiereDerecha)   velocidadX =  7;

  const yaVaRapaArriba = cuerpo.velocity.y < -1;
  const puedesSaltar   = quiereSaltar && enSuelo && !yaVaRapaArriba;

  if (puedesSaltar) {
    Body.setVelocity(cuerpo, { x: velocidadX, y: -15 });
    return;
  }

  Body.setVelocity(cuerpo, { x: velocidadX, y: cuerpo.velocity.y });
}

export function estaEnSuelo(cuerpo: Matter.Body, mundo: Matter.World): boolean {
  const todosCuerpos = Composite.allBodies(mundo);

  // Pie del jugador: borde inferior
  const pieY   = cuerpo.bounds.max.y;
  const izqX   = cuerpo.bounds.min.x + 4;
  const derX   = cuerpo.bounds.max.x - 4;

  for (const otro of todosCuerpos) {
    if (otro === cuerpo)  continue;

    const esSuelo = otro.isStatic;
    const esCaja  = otro.label?.startsWith('caja-');
    if (!esSuelo && !esCaja) continue;

    const superficieTecho = otro.bounds.min.y;
    const superficieIzq   = otro.bounds.min.x;
    const superficieDer   = otro.bounds.max.x;

    const tocaVertical    = pieY >= superficieTecho - 6 && pieY <= superficieTecho + 6;
    const tocaHorizontal  = derX > superficieIzq && izqX < superficieDer;

    if (tocaVertical && tocaHorizontal) return true;
  }

  return false;
}

export function avanzarMotor(motor: Matter.Engine, deltaMs: number) {
  Engine.update(motor, deltaMs);
}