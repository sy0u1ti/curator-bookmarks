import {defineConfig, type Plugin} from 'vite';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const taskDirectory = fileURLToPath(new URL('../../.tmp/curator-intro/', import.meta.url));

// A local sink for Remotion's in-browser renderer. Outputs stay in the ignored
// task directory; nothing is uploaded by the preview or render operation.
function outputSink(): Plugin {
  return {
    name: 'curator-film-local-output',
    configureServer(server) {
      server.middlewares.use('/film-output', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end();
          return;
        }
        const url = new URL(request.url || '/', 'http://127.0.0.1');
        const filename = url.searchParams.get('name') || '';
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(mp4|png|json)$/.test(filename)) {
          response.statusCode = 400;
          response.end('Invalid output name');
          return;
        }
        try {
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of request) {
            bytes += chunk.length;
            if (bytes > 300 * 1024 * 1024) throw new Error('Output exceeds local limit');
            chunks.push(Buffer.from(chunk));
          }
          const directory = path.join(taskDirectory, 'render');
          await mkdir(directory, {recursive: true});
          await writeFile(path.join(directory, filename), Buffer.concat(chunks));
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({file: filename, bytes}));
        } catch (error) {
          response.statusCode = 500;
          response.end(error instanceof Error ? error.message : 'Write failed');
        }
      });
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  plugins: [outputSink()],
  server: {host: '127.0.0.1', port: 4316, strictPort: true},
  build: {outDir: path.join(taskDirectory, 'preview-build'), emptyOutDir: true},
});
