import React, { useState, useRef } from 'react';import { StatusBar }               from 'expo-status-bar';

import { PantallaConexion } from './screens/PantallaConectarAlJuego';
import { PantallaGamepad  } from './screens/ControlesJugador';
import { AppLayout } from './screens/AppLayout';

// Datos que el servidor me devuelve al conectarnos
export type InfoJugador = {
  id:     string;
  nombre: string;
  color:  string;
};

export default function App() {
  const [infoJugador, setInfoJugador] = useState<InfoJugador | null>(null);

  // Guardamos el WebSocket para poder cerrarlo al desconectar
  const wsRef = useRef<WebSocket | null>(null);

  function alConectarse(info: InfoJugador, ws: WebSocket) {
    wsRef.current = ws;
    setInfoJugador(info);
  }

  function alDesconectarse() {
    wsRef.current?.close();
    wsRef.current = null;
    setInfoJugador(null);
  }

  return (
    <AppLayout >
      <StatusBar style="light" />

      {!infoJugador ? (
        <PantallaConexion onConectado={alConectarse} />
      ) : (
        <PantallaGamepad
          ws={wsRef.current!}
          infoJugador={infoJugador}
          onDesconectar={alDesconectarse}
        />
      )}
    </AppLayout>
  );
}
