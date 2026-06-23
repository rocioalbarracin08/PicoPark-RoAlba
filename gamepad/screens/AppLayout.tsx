import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  children: React.ReactNode;
};

export function AppLayout({ children }: Props) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});