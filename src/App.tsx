import { Routes, Route, Navigate } from 'react-router-dom';
import Splash from './screens/Splash';
import Welcome from './screens/Welcome';
import MainMenu from './screens/MainMenu';
import GameScreen from './screens/GameScreen';
import GameOver from './screens/GameOver';
import ChallengeSelect from './screens/ChallengeSelect';
import Settings from './screens/Settings';
import HowToPlay from './screens/HowToPlay';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/menu" element={<MainMenu />} />
      <Route path="/play" element={<GameScreen />} />
      <Route path="/over" element={<GameOver />} />
      <Route path="/challenges" element={<ChallengeSelect />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/how" element={<HowToPlay />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
