import Matter from 'matter-js';
import type { ConfigNivel } from './niveles.ts';
import type { EstadoJuego, Jugador } from './tipos';

const { Engine, Bodies, Body, World, Events, Runner } = Matter;

// Física de los jugadores
const VELOCIDAD_MOVIMIENTO = 5;
const FUERZA_SALTO        = -0.015;
const MASA_JUGADOR        = 1;

export interface MotorFisico {
  motor:        Matter.Engine;
  mundo:        Matter.World;
  cuerpoLlave: Matter.Body | null;
  cuerposPuerta: Matter.Body[];
  actualizar:   () => void;
  destruir:     () => void;
}

// Crea el mundo a partir del plano del nivel
export function crearMotorFisico(
  nivel: ConfigNivel,
  alMoverseJugador: (cuerpo: Matter.Body) => void,
): MotorFisico {
  const motor = Engine.create({
    gravity: { x: 0, y: 1.5 }, // gravedad más fuerte para mejor sensación de juego
  });

  const mundo = motor.world;

  // Crear plataformas estáticas (no se mueven)
  const cuerposPlataformas = nivel.plataformas.map((p) =>
    Bodies.rectangle(p.x, p.y, p.ancho, p.alto, {
      isStatic: true,
      label: p.etiqueta ?? 'plataforma',
      friction: 0.8,
    })
  );
  World.add(mundo, cuerposPlataformas);

  // Crear la llave (pequeño cuerpo dinámico)
  const cuerpoLlave = Bodies.circle(
    nivel.posicionLlave.x,
    nivel.posicionLlave.y,
    15,
    {
      label: 'llave',
      isSensor: false,
      isStatic: true, // la llave no cae hasta que alguien la toque
      collisionFilter: { mask: 0x0002 }, // solo colisiona con jugadores
    }
  );
  World.add(mundo, cuerpoLlave);

  // Crear zona de la puerta (sensor que detecta jugadores)
  const cuerposPuerta = [
    Bodies.rectangle(
      nivel.posicionPuerta.x,
      nivel.posicionPuerta.y,
      60, 80,
      {
        isStatic: true,
        isSensor: true, // no bloquea, solo detecta colisión
        label: 'puerta',
      }
    ),
  ];
  World.add(mundo, cuerposPuerta);

  // El motor corre en un loop fijo (60hz internamente, nosotros enviamos a 30hz)
  const runner = Runner.create();
  Runner.run(runner, motor);

  return {
    motor,
    mundo,
    cuerpoLlave,
    cuerposPuerta,
    actualizar: () => {
      // Esta función es llamada desde el loop de 30FPS del servidor
      // No necesitamos hacer nada aquí, Runner.run ya lo maneja internamente
    },
    destruir: () => {
      Runner.stop(runner);
      Engine.clear(motor);
      World.clear(mundo, false);
    },
  };
}

// Crea el cuerpo físico de un jugador nuevo
export function crearCuerpoJugador(x: number, y: number, id: string): Matter.Body {
  return Bodies.rectangle(x, y, 40, 60, {
    label: `jugador-${id}`,
    friction: 0.5,
    frictionAir: 0.1,
    mass: MASA_JUGADOR,
    // Evita que el jugador rote (se quedaría tirado)
    inertia: Infinity,
    collisionFilter: {
      category: 0x0002,
      mask: 0x0001 | 0x0002, // colisiona con plataformas y otros jugadores
    },
  });
}

// Aplica movimiento a un jugador según el input recibido
export function aplicarMovimiento(
  cuerpo: Matter.Body,
  direccion: 'izquierda' | 'derecha' | 'salto' | 'ninguna',
  estaEnSuelo: boolean,
): void {
  switch (direccion) {
    case 'izquierda':
      Body.setVelocity(cuerpo, { x: -VELOCIDAD_MOVIMIENTO, y: cuerpo.velocity.y });
      break;
    case 'derecha':
      Body.setVelocity(cuerpo, { x: VELOCIDAD_MOVIMIENTO, y: cuerpo.velocity.y });
      break;
    case 'salto':
      // Solo salta si está tocando el suelo (evita salto infinito)
      if (estaEnSuelo) {
        Body.applyForce(cuerpo, cuerpo.position, { x: 0, y: FUERZA_SALTO });
      }
      break;
    case 'ninguna':
      // Frena horizontalmente cuando no hay input
      Body.setVelocity(cuerpo, { x: cuerpo.velocity.x * 0.8, y: cuerpo.velocity.y });
      break;
  }
}

// Detecta si un cuerpo está tocando el suelo (para permitir salto)
export function estaEnSuelo(cuerpo: Matter.Body, motor: Matter.Engine): boolean {
  const cuerpos = Matter.Composite.allBodies(motor.world);
  // Punto de detección: ligeramente debajo del jugador
  const puntoAbajo = {
    x: cuerpo.position.x,
    y: cuerpo.position.y + 31, // mitad del alto del jugador + 1
  };

  return cuerpos.some((otro) => {
    if (otro === cuerpo || !otro.isStatic) return false;
    return Matter.Bounds.contains(otro.bounds, puntoAbajo);
  });
}