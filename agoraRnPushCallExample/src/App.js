import React from 'react';
import AgoraView from './components/AgoraView';
import {useColorScheme} from 'react-native';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return <AgoraView isDarkMode={isDarkMode} />;
}
