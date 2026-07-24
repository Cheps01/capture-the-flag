import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, 150, 'CTF Game', {
      fontSize: '48px',
      color: '#e0e0e0',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.createButton(width / 2, 300, 'Iniciar como Servidor', () => {
      console.log('Servidor seleccionado');
    });

    this.createButton(width / 2, 390, 'Unirse como Cliente', () => {
      console.log('Cliente seleccionado');
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 280, 55, 0x16213e)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const text = this.add.text(x, y, label, {
      fontSize: '20px',
      color: '#a0c4ff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x0f3460);
      text.setColor('#ffffff');
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x16213e);
      text.setColor('#a0c4ff');
    });

    bg.on('pointerdown', onClick);
  }
}