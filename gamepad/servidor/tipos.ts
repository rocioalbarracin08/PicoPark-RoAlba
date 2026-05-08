import type Matter from 'matter-js';


export type FaseJuego = 'lobby' | 'jugando' | 'nivel-completado';

export interface Jugador {
  id:            string;
  nombre:        string;
  color:         string;
  cuerpofisico:  Matter.Body;  
  cargandoLlave: boolean;
  conectado:     boolean;
}

export interface EstadoJuego {
  fase:          FaseJuego;
  nivelActual:   number;
  jugadores:     Map<string, Jugador>;
  llaveRecogida: boolean;
  llaveEnJuego:  boolean;
}


export const CONFIGS_JUGADORES = [
  { color: 'lightblue', nombre: 'Jugador 1' },
  { color: 'purple',    nombre: 'Jugador 2' },
  { color: 'red',       nombre: 'Jugador 3' },
  { color: 'orange',    nombre: 'Jugador 4' },
] as const;

export const MAX_JUGADORES = 4;

export function crearEstadoInicial(): EstadoJuego {
  return {
    fase:          'lobby',
    nivelActual:   1,
    jugadores:     new Map(),
    llaveRecogida: false,
    llaveEnJuego:  true,
  };
}