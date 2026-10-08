import { useEffect, useState } from 'react';
import { ConnectionBanner, ErrorToast } from './components/Notices';
import { useGameClient } from './hooks/useGameClient';
import { GamePage } from './pages/GamePage';
import { JoinPage } from './pages/JoinPage';
import { LobbyPage } from './pages/LobbyPage';
import { MenuPage } from './pages/MenuPage';

export function App() {
  const client = useGameClient();
  const { room, me, connected, error, clearError, actions } = client;
  const [joining, setJoining] = useState(false);
  // Once a room exists the join form is done; leaving should land on the menu.
  useEffect(() => {
    if (room) setJoining(false);
  }, [room]);

  // Seat colours still mark your boxes vs theirs; the stage stays soft lavender.
  const theme = me?.color ?? 'red';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#C7D2FE');
  }, [theme]);

  let page;
  if (room && me && room.status === 'waiting') {
    page = <LobbyPage room={room} meId={me.id} onLeave={actions.leave} />;
  } else if (room && me) {
    page = <GamePage client={client} />;
  } else if (joining) {
    page = (
      <JoinPage
        connected={connected}
        error={error}
        onBack={() => {
          clearError();
          setJoining(false);
        }}
        onJoin={actions.joinRoom}
      />
    );
  } else {
    page = (
      <MenuPage
        connected={connected}
        onSolo={actions.createSolo}
        onCreate={actions.createRoom}
        onJoin={() => setJoining(true)}
      />
    );
  }

  return (
    <div className="stage">
      <ConnectionBanner connected={connected} />
      {/* On the join screen the error is shown inline instead. */}
      <ErrorToast message={joining && !room ? null : error} onClose={clearError} />
      {page}
    </div>
  );
}
