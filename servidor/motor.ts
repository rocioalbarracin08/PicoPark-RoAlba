import Matter from 'matter-js';
import type { ConfigNivel } from './niveles';

const { Engine, Bodies, Body, World, Composite, Bounds } = Matter;

const VELOCIDAD_MOVIMIENTO = 5;
const FUERZA_SALTO         = -0.015;
const VEL_Y_MAX            = 15;

export interface MotorFisico {
  motor:         Matter.Engine;
  mundo:         Matter.World;
  cuerpoLlave:   Matter.Body | null;
  cuerposPuerta: Matter.Body[];
}

export function crearMotorFisico(nivel: ConfigNivel): MotorFisico {
  const motor = Engine.create({
    gravity: { x: 0, y: 2 },
  });

  const mundo = motor.world;

  const plataformas = nivel.plataformas.map((p) =>
    Bodies.rectangle(p.x, p.y, p.ancho, p.alto, {
      isStatic: true,
      label:    p.etiqueta ?? 'plataforma',
      friction: 0.8,
      collisionFilter: {
        category: 0x0001, 
        mask:     0x0002,
      },
    })
  );
  World.add(mundo, plataformas);

  const cuerpoLlave = Bodies.circle(
    nivel.posicionLlave.x,
    nivel.posicionLlave.y,
    15,
    { isStatic: true, label: 'llave' }
  );
  World.add(mundo, cuerpoLlave);

  const cuerposPuerta = [
    Bodies.rectangle(
      nivel.posicionPuerta.x,
      nivel.posicionPuerta.y,
      60, 80,
      { isStatic: true, isSensor: true, label: 'puerta' }
    ),
  ];
  World.add(mundo, cuerposPuerta);

  return { motor, mundo, cuerpoLlave, cuerposPuerta };
}

export function crearCuerpoJugador(x: number, y: number, id: string): Matter.Body {
  return Bodies.rectangle(x, y, 40, 60, {
    label:       `jugador-${id}`,
    friction:    0.5,
    frictionAir: 0.1,
    inertia:     Infinity, 
    collisionFilter: {
      category: 0x0002, 
      mask:     0x0001 | 0x0002, 
    },
  });
}

export function aplicarMovimiento(
  cuerpo:  Matter.Body,
  inputs:  Set<string>,
  enSuelo: boolean,
): void {
  // Movimiento horizontal
  if (inputs.has('izquierda')) {
    Body.setVelocity(cuerpo, { x: -VELOCIDAD_MOVIMIENTO, y: cuerpo.velocity.y });
  } else if (inputs.has('derecha')) {
    Body.setVelocity(cuerpo, { x: VELOCIDAD_MOVIMIENTO, y: cuerpo.velocity.y });
  } else {
    // Sin input: frena suavemente
    Body.setVelocity(cuerpo, { x: cuerpo.velocity.x * 0.8, y: cuerpo.velocity.y });
  }

  // Salto solo si está pisando algo
  if (inputs.has('salto') && enSuelo) {
    Body.applyForce(cuerpo, cuerpo.position, { x: 0, y: FUERZA_SALTO });
  }

  // Clamp velocidad vertical: evita que atraviese paredes en caída libre
  if (cuerpo.velocity.y > VEL_Y_MAX) {
    Body.setVelocity(cuerpo, { x: cuerpo.velocity.x, y: VEL_Y_MAX });
  }
}

export function estaEnSuelo(cuerpo: Matter.Body, motor: Matter.Engine): boolean {
  const todos = Composite.allBodies(motor.world);

  const puntoAbajo = {
    x: cuerpo.position.x,
    y: cuerpo.position.y + 32,
  };

  return todos.some((otro) => {
    if (otro === cuerpo || !otro.isStatic) return false;
    return Bounds.contains(otro.bounds, puntoAbajo);
  });
}

export function avanzarMotor(motor: Matter.Engine, deltaMilisegundos: number): void {
  // Dividimos el delta en pasos de 16ms para que Matter.js no se queje
  const PASO_MS  = 16;
  const pasos    = Math.ceil(deltaMilisegundos / PASO_MS);
  const deltoPaso = deltaMilisegundos / pasos;

  for (let i = 0; i < pasos; i++) {
    Engine.update(motor, deltoPaso);
  }
}