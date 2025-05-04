const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.APP_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = '1357000771761344522'; // ID du serveur cible

// Charger les commandes
const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.warn(`La commande dans ${filePath} est invalide (propriétés 'data' ou 'execute' manquantes).`);
    }
  }
}

// Déployer les commandes
const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Déploiement des commandes sur le serveur ${guildId}...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log(`Déploiement réussi : ${data.length} commandes déployées.`);
  } catch (error) {
    console.error('Erreur lors du déploiement des commandes :', error);
  }
})();