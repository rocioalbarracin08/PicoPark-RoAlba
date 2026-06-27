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
  // Cuerpo simple — sin sensor compuesto.
  // El cuerpo compuesto causaba que Matter.Query.collides detectara colisiones
  // entre las partes del mismo cuerpo y con jugadores adyacentes, generando
  // falsos positivos en estaEnSuelo que disparaban saltos fantasma.
  return Bodies.rectangle(x, y, 36, 54, {
    label:         `jugador-${etiqueta}`,
    friction:      0,
    frictionStatic: 0,
    frictionAir:   0.02,
    restitution:   0,
    inertia:       Infinity,
  });
}

export function crearCuerposCajas(cajas: Caja[]): Matter.Body[] {
  return cajas.map((caja, indice) =>
    Bodies.rectangle(caja.x, caja.y, caja.ancho, caja.alto, {
      label:       `caja-${indice}`,
      friction:    0.8,
      frictionAir: 0.05,
      restitution: 0,
      mass:        5,
      inertia:     Infinity,
    })
  );
}

export function aplicarMovimiento(
  cuerpo:  Matter.Body,
  botones: Set<string>,
  enSuelo: boolean,
) {
  let velocidadX = 0;
  if (botones.has('izquierda')) velocidadX = -7;
  if (botones.has('derecha'))   velocidadX =  7;

  // Modificamos el margen vertical para evitar el salto infinito por tirones físicos
  const yaVaRapidoArriba = cuerpo.velocity.y < -0.5; 
  
  if (botones.has('salto') && enSuelo && !yaVaRapidoArriba) {
    // Aplicamos el salto de forma limpia
    Body.setVelocity(cuerpo, { x: velocidadX, y: -15 });
    return;
  }

  Body.setVelocity(cuerpo, { x: velocidadX, y: cuerpo.velocity.y });
}

export function estaEnSuelo(cuerpo: Matter.Body, mundo: Matter.World): boolean {
  const todosCuerpos = Composite.allBodies(mundo);

  // Pie del jugador: borde inferior del bounding box
  const pieY = cuerpo.bounds.max.y;
  // Usamos un margen horizontal interno para ignorar roces laterales
  const izqX = cuerpo.bounds.min.x + 4;
  const derX = cuerpo.bounds.max.x - 4;

  for (const otro of todosCuerpos) {
    // Descartar el cuerpo propio
    if (otro === cuerpo) continue;
    if (cuerpo.parts && cuerpo.parts.includes(otro)) continue;

    const esSuelo   = otro.isStatic;
    const esCaja    = otro.label?.startsWith('caja-');
    const esJugador = otro.label?.startsWith('jugador-');

    // ¡REPARADO! Ahora permitimos plataformas estáticas, cajas Y otros jugadores
    if (!esSuelo && !esCaja && !esJugador) continue;

    const techoOtro = otro.bounds.min.y;
    const izqOtro   = otro.bounds.min.x;
    const derOtro   = otro.bounds.max.x;

    // Ventana vertical de ±10px (un poco más ajustada para evitar saltos fantasmas en colisiones rápidas)
    const tocaVertical   = pieY >= techoOtro - 10 && pieY <= techoOtro + 10;
    const tocaHorizontal = derX > izqOtro && izqX < derOtro;

    // Si está físicamente apoyado sobre el "techo" del otro objeto/jugador...
    if (tocaVertical && tocaHorizontal) {
      // Evitamos falsos positivos si el cuerpo de abajo se está moviendo hacia arriba demasiado rápido
      if (otro.velocity.y < -2) {
        continue; 
      }
      return true;
    }
  }

  return false;
}

export function avanzarMotor(motor: Matter.Engine, deltaMs: number) {
  const PASO_MAX = 16;
  let restante = deltaMs;
  while (restante > 0) {
    Engine.update(motor, Math.min(restante, PASO_MAX));
    restante -= PASO_MAX;
  }
}