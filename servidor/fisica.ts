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
    friction:    0.05,   // menos fricción con suelo → más responsivo
    frictionAir: 0.08,   // subido de 0.02 → frena naturalmente al soltar
    restitution: 0,
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
      inertia:     Infinity,
    })
  );
}

const FUERZA_MOVIMIENTO = 0.025; // fuerza horizontal por tick
const VELOCIDAD_MAX_X   = 7;     // tope de velocidad en X (px/tick)

export function aplicarMovimiento(
  cuerpo:  Matter.Body,
  botones: Set<string>,
  enSuelo: boolean,
) {
  const quiereIzquierda = botones.has('izquierda');
  const quiereDerecha   = botones.has('derecha');
  const quiereSaltar    = botones.has('salto');

  // ✅ Movimiento horizontal con applyForce en vez de setVelocity.
  // Matter integra la fuerza junto con gravedad y colisiones → sin estados corruptos.
  if (quiereIzquierda) {
    Body.applyForce(cuerpo, cuerpo.position, { x: -FUERZA_MOVIMIENTO, y: 0 });
  } else if (quiereDerecha) {
    Body.applyForce(cuerpo, cuerpo.position, { x: FUERZA_MOVIMIENTO, y: 0 });
  } else {
    // Sin input horizontal → frenar rápido en X, sin tocar Y
    Body.setVelocity(cuerpo, {
      x: cuerpo.velocity.x * 0.6,
      y: cuerpo.velocity.y,
    });
  }

  // Limitar velocidad máxima en X para que no acelere infinito
  if (Math.abs(cuerpo.velocity.x) > VELOCIDAD_MAX_X) {
    Body.setVelocity(cuerpo, {
      x: Math.sign(cuerpo.velocity.x) * VELOCIDAD_MAX_X,
      y: cuerpo.velocity.y,
    });
  }

  // ✅ Salto: solo tocamos Y, solo cuando el jugador está en el suelo
  const yaVaParaArriba = cuerpo.velocity.y < -1;
  if (quiereSaltar && enSuelo && !yaVaParaArriba) {
    Body.setVelocity(cuerpo, { x: cuerpo.velocity.x, y: -15 });
  }
}

export function estaEnSuelo(cuerpo: Matter.Body, mundo: Matter.World): boolean {
  // ✅ Usar Matter.Query.point en vez de comparar bounding boxes manualmente.
  // Query usa la misma lógica interna que Matter → más preciso y confiable.
  const pieY = cuerpo.bounds.max.y + 3; // 3px debajo del pie
  const izqX = cuerpo.bounds.min.x + 6;
  const derX = cuerpo.bounds.max.x - 6;

  // Ignoramos el propio cuerpo del jugador en la query
  const otrosCuerpos = Composite.allBodies(mundo).filter(b => b !== cuerpo);

  const colIzq = Matter.Query.point(otrosCuerpos, { x: izqX, y: pieY });
  const colDer = Matter.Query.point(otrosCuerpos, { x: derX, y: pieY });

  return colIzq.length > 0 || colDer.length > 0;
}

export function avanzarMotor(motor: Matter.Engine, deltaMs: number) {
  // ✅ Pasos fijos — correcto, no modificar
  const PASO_MAX = 16;
  let restante = deltaMs;
  while (restante > 0) {
    Engine.update(motor, Math.min(restante, PASO_MAX));
    restante -= PASO_MAX;
  }
}