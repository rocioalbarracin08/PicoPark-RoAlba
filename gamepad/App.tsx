import React, { useState, useRef } from 'react';
import { View, StyleSheet }        from 'react-native';
import { StatusBar }               from 'expo-status-bar';

import { PantallaConexion } from './screens/PantallaConectarAlJuego';
import { PantallaGamepad  } from './screens/ControlesJugador';

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
    <View style={estilos.contenedor}>
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
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex:            1,
    backgroundColor: '#1a1a2e',
  },
});