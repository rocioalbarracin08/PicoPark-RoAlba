
export interface Plataforma {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  etiqueta?: string; // para identificar cuerpos especiales
}

export interface ConfigNivel {
  numero: number;
  nombre: string;
  anchoMundo: number;
  altoMundo: number;
  plataformas: Plataforma[];
  posicionesIniciales: { x: number; y: number }[];
  posicionLlave: { x: number; y: number };
  posicionPuerta: { x: number; y: number };
  descripcion: string;
}

// Nivel 1: plataformas simples, la llave está al otro lado del mapa
export const NIVEL_1: ConfigNivel = {
  numero: 1,
  nombre: 'El Puente',
  anchoMundo: 1200,
  altoMundo: 600,
  descripcion: 'Lleguen a la llave y lleven a todos a la salida.',
  plataformas: [
    // Suelo principal
    { x: 600, y: 580, ancho: 1200, alto: 20, etiqueta: 'suelo' },
    // Plataforma del medio (obstáculo)
    { x: 400, y: 420, ancho: 200, alto: 20, etiqueta: 'plataforma-media' },
    // Plataforma alta donde está la llave
    { x: 900, y: 300, ancho: 200, alto: 20, etiqueta: 'plataforma-llave' },
    // Paredes laterales
    { x: 0,    y: 300, ancho: 20, alto: 600, etiqueta: 'pared-izquierda' },
    { x: 1200, y: 300, ancho: 20, alto: 600, etiqueta: 'pared-derecha' },
  ],
  posicionesIniciales: [
    { x: 100, y: 500 },
    { x: 150, y: 500 },
    { x: 200, y: 500 },
    { x: 250, y: 500 },
  ],
  posicionLlave:  { x: 900, y: 260 },
  posicionPuerta: { x: 1150, y: 520 },
};

// Nivel 2: los jugadores deben apilarse para alcanzar la plataforma alta
export const NIVEL_2: ConfigNivel = {
  numero: 2,
  nombre: 'La Torre',
  anchoMundo: 800,
  altoMundo: 700,
  descripcion: 'Apílense para alcanzar la llave en las alturas.',
  plataformas: [
    // Suelo
    { x: 400, y: 680, ancho: 800, alto: 20, etiqueta: 'suelo' },
    // Plataforma MUY alta, solo alcanzable apilándose
    { x: 200, y: 300, ancho: 160, alto: 20, etiqueta: 'plataforma-alta' },
    // Plataforma de salida
    { x: 650, y: 500, ancho: 200, alto: 20, etiqueta: 'plataforma-salida' },
    // Paredes
    { x: 0,   y: 350, ancho: 20, alto: 700, etiqueta: 'pared-izquierda' },
    { x: 800, y: 350, ancho: 20, alto: 700, etiqueta: 'pared-derecha' },
  ],
  posicionesIniciales: [
    { x: 200, y: 600 },
    { x: 250, y: 600 },
    { x: 300, y: 600 },
    { x: 350, y: 600 },
  ],
  posicionLlave:  { x: 200, y: 260 },
  posicionPuerta: { x: 650, y: 450 },
};

export const NIVELES: ConfigNivel[] = [NIVEL_1, NIVEL_2];