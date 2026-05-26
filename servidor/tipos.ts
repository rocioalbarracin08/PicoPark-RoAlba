import type Matter from 'matter-js';

export type FaseJuego = 'esperando' | 'jugando' | 'nivel-completado';

export interface Jugador {
  id:            string;
  nombre:        string;
  color:         string;
  cuerpofisico:  Matter.Body;
  cargandoLlave: boolean;
  conectado:     boolean;
  slotIndex:     number;  
}

export interface EstadoJuego {
  fase:          FaseJuego;
  nivelActual:   number;
  jugadores:     Map<string, Jugador>;
  llaveRecogida: boolean;
  llaveEnJuego:  boolean;
}

export const CONFIGS_JUGADORES = [
  { color: '#85bdd8', nombre: 'Jugador 1' },
  { color: '#ce93d8', nombre: 'Jugador 2' },
  { color: '#b85656', nombre: 'Jugador 3' },
  { color: '#fddcab', nombre: 'Jugador 4' },
] as const;

export const MAX_JUGADORES     = 4;
export const MIN_PARA_GANAR    = 3; 

export function crearEstadoInicial(): EstadoJuego {
  return {
    fase:          'jugando',
    nivelActual:   1,
    jugadores:     new Map(),
    llaveRecogida: false,
    llaveEnJuego:  false,
  };
}