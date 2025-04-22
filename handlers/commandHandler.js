const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

// Fonction pour charger les commandes
function loadCommands(client) {
  client.commands = new Map();
  const commandsArray = [];
  
  const foldersPath = path.join(__dirname, '..', 'commands');
  
  if (!fs.existsSync(foldersPath)) {
    logger.error("Le dossier de commandes est introuvable.");
    return { commands: client.commands, commandsArray };
  }
  
  const commandFolders = fs.readdirSync(foldersPath);
  
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    
    if (!fs.existsSync(commandsPath) || !fs.statSync(commandsPath).isDirectory()) {
      continue;
    }
    
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      
      try {
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          commandsArray.push(command.data.toJSON());
        } else {
          logger.warning(`La commande ${filePath} n'a pas les propriétés requises 'data' ou 'execute'.`);
        }
      } catch (error) {
        logger.error(`Erreur lors du chargement de la commande ${filePath}`, error);
      }
    }
  }
  
  return { commands: client.commands, commandsArray };
}

module.exports = { loadCommands };