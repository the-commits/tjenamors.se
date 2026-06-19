#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://radio.tjenamors.se/api';
const STATION = '1';

const root = dirname(fileURLToPath(import.meta.url));
const envPath = join(root, '..', '.env');

async function loadEnv() {
  let key = process.env.AZURACAST_API_KEY;
  if (!key) {
    try {
      const raw = await readFile(envPath, 'utf8');
      const match = raw.match(/^AZURACAST_API_KEY\s*=\s*(.+)$/m);
      if (match) key = match[1].trim().replace(/^["']|["']$/g, '');
    } catch (_) {}
  }
  if (!key) {
    console.error('No API key found. Set AZURACAST_API_KEY env var or create .env with:');
    console.error('  AZURACAST_API_KEY=your-key-here');
    process.exit(1);
  }
  return key;
}

async function api(method, path, key, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'X-API-Key': key,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`API ${method} ${path} failed: ${res.status}`);
    console.error(text);
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  const key = await loadEnv();

  switch (cmd) {
    case 'status': {
      const data = await api('GET', `/nowplaying/${STATION}`, key);
      const np = data.now_playing;
      console.log(`Station: ${data.station.name}`);
      console.log(`Online: ${data.is_online}`);
      console.log(`Listeners: ${data.listeners.current}`);
      if (data.is_online && np.song) {
        console.log(`Now playing: ${np.song.text}`);
        console.log(`Elapsed: ${np.elapsed}s / ${np.duration}s`);
      }
      break;
    }
    case 'playlists': {
      const data = await api('GET', `/station/${STATION}/playlists`, key);
      if (!Array.isArray(data)) {
        console.error('Unexpected response:', data);
        break;
      }
      console.log('ID   Name                            Enabled  Songs');
      console.log('---  ------------------------------  -------  -----');
      for (const p of data) {
        const id = String(p.id).padEnd(4);
        const name = (p.name ?? '').slice(0, 30).padEnd(30);
        const en = (p.is_enabled ? 'yes' : 'no').padEnd(7);
        const songs = String(p.num_songs ?? '?');
        console.log(`${id}  ${name}  ${en}  ${songs}`);
      }
      break;
    }
    case 'enable': {
      const id = args[0];
      if (!id) {
        console.error('Usage: azuracast enable <playlist-id>');
        process.exit(1);
      }
      await api('PUT', `/station/${STATION}/playlist/${id}`, key, { is_enabled: true });
      console.log(`Playlist ${id} enabled`);
      break;
    }
    case 'disable': {
      const id = args[0];
      if (!id) {
        console.error('Usage: azuracast disable <playlist-id>');
        process.exit(1);
      }
      await api('PUT', `/station/${STATION}/playlist/${id}`, key, { is_enabled: false });
      console.log(`Playlist ${id} disabled`);
      break;
    }
    case 'restart': {
      await api('POST', `/station/${STATION}/restart`, key);
      console.log('Station restart triggered');
      break;
    }
    default:
      console.log('Usage: node scripts/azuracast.mjs <command>');
      console.log('');
      console.log('Commands:');
      console.log('  status           Show station status');
      console.log('  playlists        List all playlists');
      console.log('  enable <id>      Enable a playlist');
      console.log('  disable <id>     Disable a playlist');
      console.log('  restart          Restart the station');
      console.log('');
      console.log('Set AZURACAST_API_KEY env var or create .env with the key.');
  }
}

main();
