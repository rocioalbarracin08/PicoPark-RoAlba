import type Matter from 'matter-js';

export type FaseJuego = 'esperando' | 'jugando' | 'nivel-completado';

export interface Jugador {
  id:            string;  
  nombre:        string;   
  color:         string;  
  cuerpoFisico:  Matter.Body;
  cargandoLlave: boolean;  
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
  { nombre: 'Jugador 1', color: '#85bdd8' },
  { nombre: 'Jugador 2', color: '#ce93d8' },
  { nombre: 'Jugador 3', color: '#ef9a9a' },
  { nombre: 'Jugador 4', color: '#fddcab' },
] as const;


export const MAX_JUGADORES = 4;  // máximo de jugadores simultáneos

export const MIN_JUGADORES_PARA_GANAR = 3;

export function crearEstadoInicial(): EstadoJuego {
  return {
    fase:          'esperando',
    nivelActual:   1,
    jugadores:     new Map(),
    llaveRecogida: false,
    llaveEnJuego:  false,
  };
}