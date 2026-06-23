export interface Plataforma {
  x:         number;
  y:         number;
  ancho:     number;
  alto:      number;
  etiqueta?: string;
}

export interface Caja {
  x:     number;
  y:     number;
  ancho: number;
  alto:  number;
}

export interface ConfigNivel {
  numero:              number;
  nombre:              string;
  anchoMundo:          number;
  altoMundo:           number;
  plataformas:         Plataforma[];
  cajas:               Caja[];
  posicionesIniciales: { x: number; y: number }[];
  posicionLlave:       { x: number; y: number };
  posicionPuerta:      { x: number; y: number };
}

export const NIVEL_1: ConfigNivel = {
  numero:     1,
  nombre:     'El Puente',
  anchoMundo: 1200,
  altoMundo:  580,

  plataformas: [
    { x: 150,  y: 560, ancho: 280,  alto: 20, etiqueta: 'suelo-izq'  },
    { x: 490,  y: 430, ancho: 160,  alto: 20, etiqueta: 'plat-media' },
    { x: 965,  y: 560, ancho: 430,  alto: 20, etiqueta: 'suelo-der'  }, // ← extendido hasta x=1180 para cubrir la puerta
    { x: 850,  y: 380, ancho: 160,  alto: 20, etiqueta: 'plat-alta'  }, // ← bajada de 300 a 380 para ser alcanzable
    { x: 10,   y: 290, ancho: 20,   alto: 580, etiqueta: 'pared-izq' },
    { x: 1190, y: 290, ancho: 20,   alto: 580, etiqueta: 'pared-der' },
  ],

  cajas: [
    { x: 200, y: 515, ancho: 44, alto: 44 },
    { x: 950, y: 515, ancho: 44, alto: 44 },
  ],

  posicionesIniciales: [
    { x: 80,  y: 510 },
    { x: 130, y: 510 },
    { x: 820, y: 510 },
    { x: 870, y: 510 },
  ],

  posicionLlave:  { x: 850, y: 340 }, // ← encima de plat-alta (y=380, superficie=370, llave flota 30px arriba)
  posicionPuerta: { x: 1100, y: 550 }, // ← y=550 = superficie del suelo-der, puerta apoya en el piso
};

export const NIVEL_2: ConfigNivel = {
  numero:     2,
  nombre:     'La Torre',
  anchoMundo: 800,
  altoMundo:  650,

  plataformas: [
    { x: 150,  y: 630, ancho: 280, alto: 20, etiqueta: 'suelo-izq'   },
    { x: 640,  y: 630, ancho: 280, alto: 20, etiqueta: 'suelo-der'   },
    { x: 200,  y: 320, ancho: 160, alto: 20, etiqueta: 'plat-alta'   },
    { x: 630,  y: 460, ancho: 200, alto: 20, etiqueta: 'plat-salida' },
    { x: 10,   y: 325, ancho: 20,  alto: 650, etiqueta: 'pared-izq'  },
    { x: 790,  y: 325, ancho: 20,  alto: 650, etiqueta: 'pared-der'  },
  ],

  cajas: [
    { x: 180, y: 585, ancho: 44, alto: 44 },
    { x: 230, y: 585, ancho: 44, alto: 44 },
  ],

  posicionesIniciales: [
    { x: 80,  y: 580 },
    { x: 130, y: 580 },
    { x: 180, y: 580 },
    { x: 230, y: 580 },
  ],

  posicionLlave:  { x: 200, y: 280 },
  posicionPuerta: { x: 710, y: 400 },
};

export const NIVELES: ConfigNivel[] = [NIVEL_1, NIVEL_2];