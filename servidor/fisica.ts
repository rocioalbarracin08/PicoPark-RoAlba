import Matter from 'matter-js';

const {
  Engine,
  Bodies,
  Body,
  World,
  Composite,
} = Matter;

export function crearMotorFisico() {

  const motor = Engine.create({
    gravity: {
      x: 0,
      y: 1.4,
    },
  });

  return {
    motor,
    mundo: motor.world,
  };
}

export function crearCuerpoJugador(
  x: number,
  y: number,
  id: string,
) {

  return Bodies.rectangle(
    x,
    y,
    40,
    60,
    {
      label: `jugador-${id}`,

      friction: 0,
      frictionAir: 0,

      inertia: Infinity,
    }
  );
}

export function aplicarMovimiento(
  cuerpo: Matter.Body,
  inputs: Set<string>,
  enSuelo: boolean,
) {

  let vx = cuerpo.velocity.x;

  // MOVIMIENTO
  if (inputs.has('izquierda')) {
    vx = -7;
  }

  if (inputs.has('derecha')) {
    vx = 7;
  }

  if (
    !inputs.has('izquierda')
    &&
    !inputs.has('derecha')
  ) {
    vx = 0;
  }

  if (
    inputs.has('salto')
    &&
    enSuelo
    &&
    Math.abs(cuerpo.velocity.y) < 1
  ) {

    Body.setVelocity(cuerpo, {
      x: vx,
      y: -13,
    });

    return;
  }

  Body.setVelocity(cuerpo, {
    x: vx,
    y: cuerpo.velocity.y,
  });
}

export function estaEnSuelo(
  cuerpo: Matter.Body,
  motor: Matter.Engine,
) {

  const todos =
    Composite.allBodies(motor.world);

  for (const otro of todos) {

    if (otro === cuerpo) continue;

    if (!otro.isStatic) continue;

    const tocando =
      cuerpo.bounds.max.y <= otro.bounds.min.y + 10
      &&
      cuerpo.bounds.max.y >= otro.bounds.min.y - 10
      &&
      cuerpo.bounds.max.x > otro.bounds.min.x
      &&
      cuerpo.bounds.min.x < otro.bounds.max.x;

    if (tocando) {
      return true;
    }
  }

  return false;
}

export function avanzarMotor(
  motor: Matter.Engine,
  delta: number,
) {
  Engine.update(motor, delta);
}