import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PantallaConexion } from './screens/PantallaConexion';
import { PantallaGamepad } from './screens/PantallaGamepad';
import { Socket } from 'socket.io-client';

export type InfoJugador = {
  id:     string;
  nombre: string;
  color:  string;
};

export default function App() {
  const [servidorUrl, setServidorUrl]   = useState<string | null>(null);
  const [infoJugador, setInfoJugador]   = useState<InfoJugador | null>(null);
  const socketRef                       = useRef<Socket | null>(null);

  function handleConectado(url: string, info: InfoJugador, socket: Socket) {
    socketRef.current = socket;
    setServidorUrl(url);
    setInfoJugador(info);
  }

  function handleDesconectar() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setServidorUrl(null);
    setInfoJugador(null);
  }

  return (
    <View style={styles.contenedor}>
      <StatusBar style="light" />
      {!servidorUrl || !infoJugador ? (
        <PantallaConexion onConectado={handleConectado} />
      ) : (
        <PantallaGamepad
          socket={socketRef.current!}
          infoJugador={infoJugador}
          onDesconectar={handleDesconectar}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex:            1,
    backgroundColor: '#1a1a2e',
  },
});