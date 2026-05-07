import React from 'react';

interface Props {
  x:             number;
  y:             number;
  color:         string;
  nombre:        string;
  cargandoLlave: boolean;
} 

export function Jugador({ x, y, color, nombre, cargandoLlave }: Props) {
  return (
    <div
      style={{
        position:        'absolute',
        left:            x - 20,
        top:             y - 30,
        width:           40,
        height:          60,
        backgroundColor: color,
        borderRadius:    8,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        10,
        color:           'white',
        fontWeight:      'bold',
        boxShadow:       '0 2px 8px rgba(0,0,0,0.3)',
        transition:      'left 0.03s, top 0.03s',
      }}
    >
      {cargandoLlave && <span style={{ fontSize: 16 }}>🗝️</span>}
      <span>{nombre.split(' ')[1]}</span>
    </div>
  );
}