import { useState } from 'react'
import Lobby from './components/Lobby'
import Game from './components/Game'
import './App.css'

function App() {
  const [gameData, setGameData] = useState(null)

  const handleJoinGame = (data) => {
    setGameData(data)
  }

  const handleLeaveGame = () => {
    setGameData(null)
  }

  return (
    <>
      {gameData ? (
        <Game
          roomCode={gameData.code}
          playerIdx={gameData.playerIdx}
          playerName={gameData.playerName}
          onLeave={handleLeaveGame}
        />
      ) : (
        <Lobby onJoin={handleJoinGame} />
      )}
    </>
  )
}

export default App
