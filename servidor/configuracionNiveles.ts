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
    { x: 965,  y: 560, ancho: 430,  alto: 20, etiqueta: 'suelo-der'  },  
    { x: 850,  y: 380, ancho: 160,  alto: 20, etiqueta: 'plat-alta'  }, 
    { x: 10,   y: 290, ancho: 20,   alto: 580, etiqueta: 'pared-izq' },
    { x: 1190, y: 290, ancho: 20,   alto: 580, etiqueta: 'pared-der' },
  ],

  cajas: [
    { x: 200, y: 515, ancho: 44, alto: 44 },
    { x: 950, y: 515, ancho: 44, alto: 44 },
  ],

posicionesIniciales: [
  { x: 70,  y: 510 },
  { x: 120, y: 510 },
  { x: 170, y: 510 },
  { x: 220, y: 510 },
],

  posicionLlave:  { x: 850, y: 340 }, 
  posicionPuerta: { x: 1100, y: 550 }, 
};

export const NIVEL_2: ConfigNivel = {
  numero: 2,
  nombre: 'La Torre',

  anchoMundo: 1200,
  altoMundo: 580,

  plataformas: [
    { x: 600, y: 560, ancho: 1180, alto: 20, etiqueta: 'suelo'},

    { x: 250,  y: 320, ancho: 160, alto: 20, etiqueta:'plat1' },
    { x: 750,  y: 460, ancho: 200, alto: 20, etiqueta:'plat2' },

    { x: 10,   y: 290, ancho: 20, alto: 580, etiqueta:'pared-izq' },
    { x: 1190, y: 290, ancho: 20, alto: 580, etiqueta:'pared-der' },
  ],

  cajas: [
    { x: 180, y: 515, ancho: 44, alto: 44 },
    { x: 230, y: 515, ancho: 44, alto: 44 },
  ],

  posicionesIniciales: [
    { x: 80,  y: 510 },
    { x: 130, y: 510 },
    { x: 180, y: 510 },
    { x: 230, y: 510 },
  ],

  posicionLlave: {
    x: 250,
    y: 280,
  },

  posicionPuerta: {
    x: 1040,
    y: 550,
  },
};

export const NIVELES: ConfigNivel[] = [NIVEL_1, NIVEL_2];