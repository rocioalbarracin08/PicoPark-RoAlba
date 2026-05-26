import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { io, Socket } from 'socket.io-client';
import type { InfoJugador } from '../App';

interface Props {
  onConectado: (url: string, info: InfoJugador, socket: Socket) => void;
}

export function PantallaConexion({ onConectado }: Props) {
  const [ip, setIp]                     = useState('');
  const [conectando, setConectando]     = useState(false);
  const [modoQR, setModoQR]             = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const yaConecto                       = useRef(false);

  function extraerHost(texto: string): string {
    const limpio = texto
      .trim()
      .replace(/^https?:\/\//, '')
      .split('/')[0];

    if (!limpio) return '';

    return limpio.includes(':')
      ? limpio
      : `${limpio}`;
  }

  function conectar(ipTexto: string) {
    const host = extraerHost(ipTexto.trim());
    if (!host) {
      Alert.alert('Error', 'Ingresá una IP válida, ej: 192.168.1.5');
      return;
    }

    const url = `http://${host}`;
    setConectando(true);
    yaConecto.current = false;

    const socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on('bienvenido', (info: InfoJugador) => {
      if (yaConecto.current) return;
      yaConecto.current = true;
      socket.off('bienvenido');
      socket.off('partida-llena');
      socket.off('connect_error');
      socket.io.opts.reconnection = true;
      setConectando(false);
      onConectado(url, info, socket);
    });

    socket.on('partida-llena', () => {
      setConectando(false);
      socket.disconnect();
      Alert.alert('Partida llena', 'Ya hay 4 jugadores. Esperá a que haya lugar.');
    });

    socket.on('connect_error', (err) => {
      if (yaConecto.current) return;
      yaConecto.current = true;  // ← marcar como "ya manejado" (no solo en éxito)

      console.log('❌ Error conexión:', err.message);
      setConectando(false);
      socket.disconnect();

      Alert.alert(
        'Sin conexión',
        `No hay servidor en ${host}.\nVerificá la IP e intentá de nuevo.`
      );
    });

    socket.on('error', (err) => {
      console.log('❌ Error con socket:', err);
    });

    setTimeout(() => {
      if (!yaConecto.current) {
        socket.disconnect();
        setConectando(false);
        Alert.alert('Sin respuesta', 'El servidor no respondió. Verificá que el juego esté corriendo.');
      }
    }, 5000);
  }

  async function abrirQR() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos la cámara para escanear el QR.');
        return;
      }
    }
    setModoQR(true);
  }

  function onQREscaneado({ data }: { data: string }) {
    if (conectando) return;
    setModoQR(false);
    setIp(data);
    conectar(data);
  }

  if (modoQR) {
    return (
      <View style={styles.contenedor}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={onQREscaneado}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.qrOverlay}>
          <View style={styles.qrMarco} />
          <Text style={styles.qrTexto}>Apuntá al QR del juego</Text>
          <TouchableOpacity style={styles.botonCancelar} onPress={() => setModoQR(false)}>
            <Text style={styles.botonCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.subtitulo}>Gamepad - PicoPark</Text>

        <TouchableOpacity style={styles.botonQR} onPress={abrirQR} disabled={conectando}>
          <Text style={styles.botonQRTexto}>Escanear QR del juego</Text>
        </TouchableOpacity>

        <Text style={styles.separador}>— o ingresá la IP manualmente —</Text>

        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="por ej: 192.168.1.5:3000"
          placeholderTextColor="#555"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!conectando}
          onSubmitEditing={() => {
            if (ip.trim()) {
              conectar(ip);
            }
          }}
        />

        <TouchableOpacity
          style={[
            styles.botonConectar,
            (conectando || !ip.trim()) && styles.botonDeshabilitado
          ]}
          onPress={() => conectar(ip)}
          disabled={conectando || !ip.trim()}
        >
          {conectando
            ? <ActivityIndicator color="#1a1a2e" />
            : <Text style={styles.botonConectarTexto}>Conectar</Text>
          }
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex:            1,
    backgroundColor: '#0f0f1e',
  },
  inner: {
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 28,
    gap:               14,
  },
  titulo: {
    fontSize:      48,
    fontWeight:    'bold',
    color:         '#85bdd8',
    letterSpacing: 2,
  },
  subtitulo: {
    fontSize:     13,
    color:        '#556',
    marginTop:    -10,
    marginBottom: 8,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  botonQR: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#151528',
    borderRadius:      14,
    paddingVertical:   16,
    paddingHorizontal: 24,
    gap:               12,
    width:             '100%',
    justifyContent:    'center',
    borderWidth:       1.5,
    borderColor:       '#85bdd8',
  },
  botonQRIcono: { fontSize: 22 },
  botonQRTexto: { color: '#85bdd8', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  separador: {
    color:         '#333',
    fontSize:      12,
    letterSpacing: 1,
  },
  input: {
    width:             '100%',
    backgroundColor:   '#151528',
    borderRadius:      12,
    paddingVertical:   16,
    paddingHorizontal: 16,
    color:             '#e0e0ff',
    fontSize:          16,
    textAlign:         'center',
    letterSpacing:     2,
    borderWidth:       1.5,
    borderColor:       '#2a2a5e',
  },
  botonConectar: {
    width:           '100%',
    backgroundColor: '#85bdd8',
    borderRadius:    12,
    paddingVertical: 16,
    alignItems:      'center',
    shadowColor:     '#85bdd8',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
    elevation:       6,
  },
  botonDeshabilitado: { opacity: 0.5 },
  botonConectarTexto: {
    color:         '#0f0f1e',
    fontSize:      17,
    fontWeight:    'bold',
    letterSpacing: 1,
  },
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  qrMarco: {
    width:           250,
    height:          250,
    borderWidth:     3,
    borderColor:     '#85bdd8',
    borderRadius:    16,
    backgroundColor: 'transparent',
  },
  qrTexto: {
    color:           '#e0e0ff',
    fontSize:        15,
    marginTop:       24,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius:    10,
  },
  botonCancelar: {
    marginTop:         20,
    backgroundColor:   'rgba(0,0,0,0.8)',
    paddingVertical:   12,
    paddingHorizontal: 32,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       '#444',
  },
  botonCancelarTexto: { color: '#aaa', fontSize: 15 },
});