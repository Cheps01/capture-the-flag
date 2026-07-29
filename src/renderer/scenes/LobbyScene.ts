import Phaser from 'phaser';
import { getPlayerName, getPlayerId } from '../client/ClientState';
import { GameServer } from '../server/GameServer';
import type { PlayerInfo } from '../../shared/types';

export class LobbyScene extends Phaser.Scene {

    private isServer = false;
    private gameServer: GameServer | null = null;
    private playerListTexts: Phaser.GameObjects.Text[] = [];
    private statusText: Phaser.GameObjects.Text | null = null;
    private countdownText: Phaser.GameObjects.Text | null = null;
    private startButton: Phaser.GameObjects.Rectangle | null = null;
    private startButtonText: Phaser.GameObjects.Text | null = null;
    private container: Phaser.GameObjects.Container | null = null;

    constructor() {
        super({ key: 'LobbyScene' });
    }

    init(data: { gameServer?: GameServer; isServer: boolean }): void {
        this.isServer = data.isServer;
        this.gameServer = data.gameServer ?? null;
    }

    create(): void {
        const { width, height } = this.scale;

        this.add.text(width / 2, 50, 'Sala de Espera', {
            fontSize: '32px',
            color: '#e0e0e0',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Mode indicator ───────────────────────────────────────
        const modeText = this.isServer ? 'Modo: Servidor (Host)' : 'Modo: Cliente';
        this.add.text(width / 2, 90, modeText, {
            fontSize: '14px',
            color: '#a0a0a0',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Status ───────────────────────────────────────────────
        this.statusText = this.add.text(width / 2, 115, 'Esperando jugadores...', {
            fontSize: '16px',
            color: '#a0c4ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Player List ──────────────────────────────────────────
        this.container = this.add.container(width / 2, 150);
        this.playerListTexts = [];

        // ── Countdown ────────────────────────────────────────────
        this.countdownText = this.add.text(width / 2, height / 2 + 80, '', {
            fontSize: '48px',
            color: '#ffcc00',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Start Button (server only) ───────────────────────────
        if (this.isServer) {
            this.startButton = this.add.rectangle(width / 2, height / 2 + 20, 260, 50, 0x16213e)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .setAlpha(0.3);

            this.startButtonText = this.add.text(width / 2, height / 2 + 20, 'Iniciar Partida', {
                fontSize: '18px',
                color: '#666666',
                fontFamily: 'monospace',
            }).setOrigin(0.5);

            this.startButton.on('pointerover', () => {
                if (this.startButton?.alpha === 1) {
                    this.startButton.setFillStyle(0x0f3460);
                    this.startButtonText?.setColor('#ffffff');
                }
            });
            this.startButton.on('pointerout', () => {
                if (this.startButton?.alpha === 1) {
                    this.startButton.setFillStyle(0x16213e);
                    this.startButtonText?.setColor('#a0c4ff');
                }
            });
            this.startButton.on('pointerdown', () => {
                this.gameServer?.startCountdown();
            });
        }

        // ── Back button ──────────────────────────────────────────
        this.createButton(80, height - 30, 'Salir', () => {
            if (this.isServer) {
                this.gameServer?.stop();
                this.gameServer = null;
            } else {
                (window as any)?.client?.disconnect?.();
            }
            this.scene.start('MenuScene');
        });

        // ── Register listeners ───────────────────────────────────
        this.registerServerListeners();
        this.registerClientListeners();
    }

    private registerServerListeners(): void {
        if (!this.gameServer) return;

        this.gameServer['callbacks'] = {
            onPhaseChange: (phase: string) => {
                if (phase === 'playing') {
                    this.scene.start('GameScene', { gameServer: this.gameServer });
                } else if (phase === 'lobby') {
                    this.countdownText?.setText('');
                    this.updateStartButton(false);
                }
            },
            onPlayersUpdate: (players: PlayerInfo[]) => {
                this.updatePlayerList(players);
                this.updateStartButton(players.length >= 2);
            },
            onCountdown: (seconds: number) => {
                this.countdownText?.setText(String(seconds));
                this.statusText?.setText('La partida comenzará pronto...');
                this.updateStartButton(false);
            },
            onStart: () => {
                this.countdownText?.setText('');
            },
            onGameOver: (winnerName: string) => {
                this.scene.start('GameOverScene', { winnerName, isServer: true });
            },
        };
    }

    private registerClientListeners(): void {
        if (this.isServer) return;

        const wc = (window as any).client;
        if (!wc) return;

        wc.onLobby((data: any) => {
            this.updatePlayerList(data.players);
        });

        wc.onCountdown((data: any) => {
            this.countdownText?.setText(String(data.seconds));
            this.statusText?.setText('La partida comenzará pronto...');
        });

        wc.onStart(() => {
            this.countdownText?.setText('');
            this.scene.start('GameScene');
        });

        wc.onGameOver((data: any) => {
            // Find winner name from player list or use ID
            this.scene.start('GameOverScene', {
                winnerName: data.winner,
                isServer: false,
            });
        });

        wc.onDisconnected(() => {
            this.statusText?.setText('Desconectado del servidor');
        });
    }

    private updatePlayerList(players: PlayerInfo[]): void {
        if (!this.container) return;

        // Clear old texts
        for (const text of this.playerListTexts) {
            text.destroy();
        }
        this.playerListTexts = [];

        const myId = getPlayerId();

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const isMe = p.id === myId;
            const prefix = isMe ? '► ' : '  ';
            const suffix = isMe ? ' (tú)' : '';

            const t = this.add.text(0, i * 30, `${prefix}${p.name}${suffix}`, {
                fontSize: '18px',
                color: isMe ? '#ffcc00' : '#e0e0e0',
                fontFamily: 'monospace',
            }).setOrigin(0.5);

            this.container.add(t);
            this.playerListTexts.push(t);
        }

        this.statusText?.setText(
            `${players.length} jugador(es) conectado(s)`
        );
    }

    private updateStartButton(enabled: boolean): void {
        if (!this.startButton || !this.startButtonText) return;
        this.startButton.setAlpha(enabled ? 1 : 0.3);
        this.startButtonText.setColor(enabled ? '#a0c4ff' : '#666666');
    }

    private createButton(x: number, y: number, label: string, onClick: () => void): void {
        const bg = this.add.rectangle(x, y, 160, 36, 0x16213e)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontSize: '14px',
            color: '#a0c4ff',
            fontFamily: 'monospace',
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
