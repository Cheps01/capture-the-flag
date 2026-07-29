import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { DiscoveryScene } from './scenes/DiscoveryScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    scene: [MenuScene, DiscoveryScene, LobbyScene, GameOverScene, GameScene],
};

new Phaser.Game(config);
