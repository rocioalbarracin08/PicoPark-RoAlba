import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Socket } from 'socket.io-client';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { InfoJugador } from '../App';

interface Props {
  socket: Socket;
  infoJugador: InfoJugador;
  onDesconectar: () => void;
}

type Direccion =
  | 'izquierda'
  | 'derecha'
  | 'salto'
  | 'arriba'
  | 'abajo';

const BTN = 72;
const BTN_SALTO = 110;

export function PantallaGamepad({
  socket,
  infoJugador,
  onDesconectar,
}: Props) {

  useKeepAwake();

  const [conectado, setConectado] = useState(socket.connected);
  const [fase, setFase] = useState('jugando');

  const presionados = useRef<Set<Direccion>>(new Set());

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    );

    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    };
  }, []);

  useEffect(() => {

    const onConnect = () => setConectado(true);
    const onDisconnect = () => setConectado(false);

    const onEstado = (data: { fase: string }) => {
      setFase(data.fase);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('estado', onEstado);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('estado', onEstado);
    };

  }, [socket, onDesconectar]);

  const presionar = useCallback((dir: Direccion) => {

    if (presionados.current.has(dir)) {
      return;
    }

    presionados.current.add(dir);

    socket.emit('input', {
      direccion: dir,
      estado: 'presionado',
    });

  }, [socket]);

  const soltar = useCallback((dir: Direccion) => {

    if (!presionados.current.has(dir)) {
      return;
    }

    presionados.current.delete(dir);

    socket.emit('input', {
      direccion: dir,
      estado: 'soltado',
    });

  }, [socket]);

  const ledColor = conectado
    ? '#00ff88'
    : '#ff4444';

  return (
    <SafeAreaView style={styles.contenedor}>

      <View style={styles.barra}>

        <View style={styles.ledRow}>
          <View
            style={[
              styles.led,
              { backgroundColor: ledColor },
            ]}
          />

          <Text style={styles.ledTexto}>
            {conectado
              ? 'Conectado'
              : 'Sin conexión'}
          </Text>
        </View>

        <View
          style={[
            styles.nombreTag,
            {
              backgroundColor: infoJugador.color + '33',
              borderColor: infoJugador.color,
            },
          ]}
        >
          <Text
            style={[
              styles.nombreTexto,
              { color: infoJugador.color },
            ]}
          >
            {infoJugador.nombre}
          </Text>
        </View>

        {fase === 'esperando' && (
          <Text style={styles.faseTexto}>
            ⏳ Esperando jugadores...
          </Text>
        )}

        {fase === 'nivel-completado' && (
          <Text
            style={[
              styles.faseTexto,
              { color: '#00ff88' },
            ]}
          >
            🎉 ¡Nivel completado!
          </Text>
        )}

        <TouchableOpacity
          style={styles.botonSalir}
          onPress={onDesconectar}
          activeOpacity={0.7}
        >
          <Text style={styles.botonSalirTexto}>
            Salir
          </Text>
        </TouchableOpacity>

      </View>

      <View
        style={styles.controles}
        pointerEvents="box-none"
      >

        <View style={styles.dpad}>

          <View style={styles.filaDpad}>

            <View style={{ width: BTN }} />

            <TouchableOpacity
              style={[styles.btnDir, styles.btnSecundario]}
              onPressIn={() => presionar('arriba')}
              onPressOut={() => soltar('arriba')}
              activeOpacity={0.7}
              delayLongPress={999999}
            >
              <Text style={styles.btnDirTexto}>
                ▲
              </Text>
            </TouchableOpacity>

            <View style={{ width: BTN }} />

          </View>

          <View style={styles.filaDpad}>

            <TouchableOpacity
              style={styles.btnDir}
              onPressIn={() => presionar('izquierda')}
              onPressOut={() => soltar('izquierda')}
              activeOpacity={0.7}
              delayLongPress={999999}
            >
              <Text style={styles.btnDirTexto}>
                ◀
              </Text>
            </TouchableOpacity>

            <View style={styles.btnDirCentro} />

            <TouchableOpacity
              style={styles.btnDir}
              onPressIn={() => presionar('derecha')}
              onPressOut={() => soltar('derecha')}
              activeOpacity={0.7}
              delayLongPress={999999}
            >
              <Text style={styles.btnDirTexto}>
                ▶
              </Text>
            </TouchableOpacity>

          </View>

          <View style={styles.filaDpad}>

            <View style={{ width: BTN }} />

            <TouchableOpacity
              style={[styles.btnDir, styles.btnSecundario]}
              onPressIn={() => presionar('abajo')}
              onPressOut={() => soltar('abajo')}
              activeOpacity={0.7}
              delayLongPress={999999}
            >
              <Text style={styles.btnDirTexto}>
                ▼
              </Text>
            </TouchableOpacity>

            <View style={{ width: BTN }} />

          </View>

        </View>

        <TouchableOpacity
          style={styles.btnSalto}
          onPressIn={() => presionar('salto')}
          onPressOut={() => soltar('salto')}
          activeOpacity={0.8}
          delayLongPress={999999}
        >
          <Text style={styles.btnSaltoLetra}>
            A
          </Text>

          <Text style={styles.btnSaltoSub}>
            SALTO
          </Text>
        </TouchableOpacity>

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  contenedor: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },

  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: 16,
    paddingVertical: 6,

    backgroundColor: '#1a1a2e',

    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },

  ledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  led: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },

  ledTexto: {
    color: '#888',
    fontSize: 11,
  },

  nombreTag: {
    paddingVertical: 3,
    paddingHorizontal: 10,

    borderRadius: 20,
    borderWidth: 1,
  },

  nombreTexto: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  faseTexto: {
    color: 'white',
    fontSize: 12,
  },

  botonSalir: {
    paddingVertical: 4,
    paddingHorizontal: 10,

    backgroundColor: '#2a2a4e',
    borderRadius: 6,
  },

  botonSalirTexto: {
    color: '#777',
    fontSize: 11,
  },

  controles: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: 40,
    paddingVertical: 12,
  },

  dpad: {
    alignItems: 'center',
  },

  filaDpad: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  btnDir: {
    width: BTN,
    height: BTN,

    borderRadius: 16,

    backgroundColor: '#1e1e3a',

    justifyContent: 'center',
    alignItems: 'center',

    borderWidth: 2,
    borderColor: '#3a3a6e',
  },

  btnSecundario: {
    opacity: 0.5,
  },

  btnDirCentro: {
    width: BTN,
    height: BTN,
  },

  btnDirTexto: {
    color: 'white',
    fontSize: 28,
  },

  btnSalto: {
    width: BTN_SALTO,
    height: BTN_SALTO,

    borderRadius: 999,

    backgroundColor: '#85bdd8',

    justifyContent: 'center',
    alignItems: 'center',

    borderWidth: 3,
    borderColor: '#b0d8ea',
  },

  btnSaltoLetra: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#0f0f1e',
  },

  btnSaltoSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,

    color: '#0f0f1e',
  },

});