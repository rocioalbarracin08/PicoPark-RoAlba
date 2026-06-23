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
  const W = 36;
  const H = 54;

  // 1. Cuerpo principal del jugador (el que colisiona con el entorno)
  const cuerpoPrincipal = Bodies.rectangle(x, y, W, H, {
    friction: 0.01,
    frictionAir: 0.02,
    restitution: 0,
    inertia: Infinity, // Evita que el personaje gire de cabeza
  });

  // 2. Sensor de pies: un micro-rectángulo debajo del cuerpo principal
  // Es más angosto (W - 6) para que pegarse a una pared no active el sensor
  const sensorPies = Bodies.rectangle(x, y + H / 2, W - 6, 4, {
    isSensor: true, // No empuja cosas, actúa como disparador de lógica
    label: `sensor-pies-${etiqueta}`
  });

  // 3. Crear un cuerpo compuesto uniendo ambos componentes
  const cuerpoCompuesto = Body.create({
    parts: [cuerpoPrincipal, sensorPies],
    label: `jugador-${etiqueta}`,
    friction: 0.01,
    frictionAir: 0.02,
    restitution: 0,
    inertia: Infinity,
  });

  return cuerpoCompuesto;
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

  let velocidadX = 0;
  if (quiereIzquierda) velocidadX = -7;
  if (quiereDerecha)   velocidadX =  7;

  // Si quiere saltar y el sensor detectó suelo, aplicamos el impulso vertical directo
  if (quiereSaltar && enSuelo) {
    Body.setVelocity(cuerpo, { x: velocidadX, y: -15 });
    return;
  }

  // Si no está saltando, mantiene la velocidad lateral y respeta la caída física de Y
  Body.setVelocity(cuerpo, { x: velocidadX, y: cuerpo.velocity.y });
}

export function estaEnSuelo(cuerpo: Matter.Body, mundo: Matter.World): boolean {
  const todosCuerpos = Composite.allBodies(mundo);

  // Buscamos la parte del cuerpo compuesto que corresponde al sensor de pies
  const miSensor = cuerpo.parts.find(part => part.label?.startsWith('sensor-pies-'));
  if (!miSensor) return false;

  // Verificamos de forma nativa qué cuerpos están chocando/superpuestos con el sensor
  const colisiones = Matter.Query.collides(miSensor, todosCuerpos);

  for (const colision of colisiones) {
    // Descartamos colisiones con el propio jugador o sus subpartes
    if (colision.bodyA === cuerpo || colision.bodyB === cuerpo) continue;

    const otroCuerpo = colision.bodyA === miSensor ? colision.bodyB : colision.bodyA;

    // Si toca una plataforma estática o una caja, el piso es válido
    const esSuelo = otroCuerpo.isStatic;
    const esCaja = otroCuerpo.label?.startsWith('caja-');

    if (esSuelo || esCaja) {
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