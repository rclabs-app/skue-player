const fs = require('fs');

const path = '/home/oem/Projetos/rclabs/projects/player/web/src/views/HomeView.vue';
let content = fs.readFileSync(path, 'utf8');

// Extract the sections
const favRegex = /<!-- Meus Favoritos -->[\s\S]*?<\/template>\n/;
const continueRegex = /\s*<!-- Continuar Assistindo -->[\s\S]*?<\/template>\n/;
const vistoRegex = /\s*<!-- Vistos Recentemente \(Histórico\) -->[\s\S]*?<\/template>\n/;
const moviesRegex = /\s*<!-- Filmes Recentes -->[\s\S]*?<\/template>\n/;
const seriesRegex = /\s*<!-- Séries Recentes -->[\s\S]*?<\/template>\n/;

let favMatch = content.match(favRegex)[0];
let continueMatch = content.match(continueRegex)[0];
let vistoMatch = content.match(vistoRegex)[0];
let moviesMatch = content.match(moviesRegex)[0];
let seriesMatch = content.match(seriesRegex)[0];

// Remove them from original string
content = content.replace(favRegex, '');
content = content.replace(continueRegex, '');
content = content.replace(vistoRegex, '');
content = content.replace(moviesRegex, '');
content = content.replace(seriesRegex, '');

// Re-insert them in new order after `<!-- HOME VIEW (Default) -->\n      <div v-show="activeCategory === 'Home'" class="space-y-10">\n`
const insertionPointStr = `<!-- HOME VIEW (Default) -->\n      <div v-show="activeCategory === 'Home'" class="space-y-10">\n`;

const newOrder = moviesMatch + seriesMatch + continueMatch + `\n      ` + favMatch;

content = content.replace(insertionPointStr, insertionPointStr + newOrder);

fs.writeFileSync(path, content, 'utf8');
console.log('HomeView updated!');
