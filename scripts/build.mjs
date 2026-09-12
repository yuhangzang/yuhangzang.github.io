import { build } from 'esbuild';

// Generated files are committed so GitHub Pages can serve this repository directly.
// Keep the two entry points separate: the error page only needs the site UI.
await Promise.all([
    build({
        entryPoints: ['assets/main.js', 'assets/publications.js'],
        outdir: 'assets', entryNames: '[name].min',
        bundle: true, minify: true, format: 'iife', target: 'es2020',
        legalComments: 'none', logLevel: 'info'
    }),
    build({ entryPoints: ['main.css'], outfile: 'main.min.css',
        minify: true, legalComments: 'none', logLevel: 'info' })
]);
