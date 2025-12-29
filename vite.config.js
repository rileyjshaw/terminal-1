import { defineConfig } from 'vite';
import favicons from '@peterek/vite-plugin-favicons';

const config = {
	path: '/terminal-1/',
	appName: 'Terminal 1',
	appShortName: 'Terminal 1',
	appDescription: 'Collatz conjecture sequencer.',
};

export default defineConfig({
	base: config.path,
	build: {
		outDir: 'dist',
	},
	plugins: [favicons('src/assets/image/logo.svg', config)],
});
