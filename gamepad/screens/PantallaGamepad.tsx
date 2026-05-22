import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Socket } from 'socket.io-client';
import type { InfoJugador } from '../App';

interface Props {
  socket:        Socket;
  infoJugador:   InfoJugador;
  onDesconectar: () => void;
}

type Direccion = 'izquierda' | 'derecha' | 'salto';

export function PantallaGamepad({ socket, infoJugador, onDesconectar }: Props) {
  useKeepAwake();

  const [conectado, setConectado] = useState(socket.connected);
  const [fase, setFase]           = useState<string>('jugando');
  const [dims, setDims]           = useState(Dimensions.get('window'));
  const presionados               = useRef<Set<Direccion>>(new Set());
  const listenersRegistrados      = useRef(false); // ← guardia anti-doble

  // Escuchar cambios de dimensión cuando rota
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDims(window);
    });
    return () => sub.remove();
  }, []);

  // Rotar a landscape
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Registrar listeners del socket UNA sola vez
  useEffect(() => {
    if (listenersRegistrados.current) return;
    listenersRegistrados.current = true;

    socket.on('connect',       () => setConectado(true));
    socket.on('disconnect',    () => setConectado(false));
    socket.on('estado',        (data: { fase: string }) => setFase(data.fase));
    socket.on('partida-llena', () => onDesconectar());

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('estado');
      socket.off('partida-llena');
      listenersRegistrados.current = false;
    };
  }, [socket]);

  const presionar = useCallback((dir: Direccion) => {
    if (presionados.current.has(dir)) return;
    presionados.current.add(dir);
    socket.emit('input', { direccion: dir, estado: 'presionado' });
  }, [socket]);

  const soltar = useCallback((dir: Direccion) => {
    if (!presionados.current.has(dir)) return;
    presionados.current.delete(dir);
    socket.emit('input', { direccion: dir, estado: 'soltado' });
  }, [socket]);

  const ledColor    = conectado ? '#00ff88' : '#ff4444';
  const alto        = Math.min(dims.width, dims.height);
  const BOTON_DIR   = alto * 0.28;
  const BOTON_SALTO = alto * 0.38;

  return (
    <View style={styles.contenedor}>
      <View style={styles.barra}>
        <View style={styles.ledRow}>
          <View style={[styles.led, { backgroundColor: ledColor }]} />
          <Text style={styles.ledTexto}>{conectado ? 'Conectado' : 'Sin conexión'}</Text>
        </View>

        <View style={[styles.nombreTag, {
          backgroundColor: infoJugador.color + '33',
          borderColor:     infoJugador.color,
        }]}>
          <Text style={[styles.nombreTexto, { color: infoJugador.color }]}>
            {infoJugador.nombre}
          </Text>
        </View>

        {fase === 'esperando' && (
          <Text style={styles.bannerTexto}>⏳ Esperando...</Text>
        )}
        {fase === 'nivel-completado' && (
          <Text style={[styles.bannerTexto, { color: '#00ff88' }]}>🎉 ¡Nivel completado!</Text>
        )}

        <TouchableOpacity onPress={onDesconectar} style={styles.botonSalir}>
          <Text style={styles.botonSalirTexto}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controles}>
        {/* D-Pad */}
        <View style={styles.dpadContenedor}>
          <View style={styles.dpadFila}>
            <TouchableOpacity
              style={[styles.botonDir, {
                width: BOTON_DIR, height: BOTON_DIR,
                borderRadius: BOTON_DIR / 5,
              }]}
              onPressIn={() => presionar('izquierda')}
              onPressOut={() => soltar('izquierda')}
              activeOpacity={0.6}
            >
              <Text style={[styles.botonDirTexto, { fontSize: BOTON_DIR * 0.4 }]}>◀</Text>
            </TouchableOpacity>

            <View style={{ width: BOTON_DIR * 0.4 }} />

            <TouchableOpacity
              style={[styles.botonDir, {
                width: BOTON_DIR, height: BOTON_DIR,
                borderRadius: BOTON_DIR / 5,
              }]}
              onPressIn={() => presionar('derecha')}
              onPressOut={() => soltar('derecha')}
              activeOpacity={0.6}
            >
              <Text style={[styles.botonDirTexto, { fontSize: BOTON_DIR * 0.4 }]}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botón A */}
        <TouchableOpacity
          style={[styles.botonSalto, {
            width: BOTON_SALTO, height: BOTON_SALTO,
            borderRadius: BOTON_SALTO / 2,
          }]}
          onPressIn={() => presionar('salto')}
          onPressOut={() => soltar('salto')}
          activeOpacity={0.6}
        >
          <Text style={[styles.botonSaltoLetra, { fontSize: BOTON_SALTO * 0.35 }]}>A</Text>
          <Text style={styles.botonSaltoSub}>SALTO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor:      { flex: 1, backgroundColor: '#0f0f1e' },
  barra:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  ledRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  led:             { width: 10, height: 10, borderRadius: 5 },
  ledTexto:        { color: '#888', fontSize: 12 },
  nombreTag:       { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  nombreTexto:     { fontSize: 13, fontWeight: 'bold' },
  bannerTexto:     { color: 'white', fontSize: 13 },
  botonSalir:      { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#2a2a4e', borderRadius: 6 },
  botonSalirTexto: { color: '#888', fontSize: 12 },
  controles:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, paddingVertical: 16 },
  dpadContenedor:  { alignItems: 'center' },
  dpadFila:        { flexDirection: 'row', alignItems: 'center' },
  botonDir:        { backgroundColor: '#2a2a4e', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#3a3a6e' },
  botonDirTexto:   { color: 'white' },
  botonSalto:      { backgroundColor: '#85bdd8', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#aad4ea', elevation: 8 },
  botonSaltoLetra: { fontWeight: 'bold', color: '#1a1a2e' },
  botonSaltoSub:   { fontSize: 11, color: '#1a1a2e', fontWeight: '600' },
});