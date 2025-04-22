const { Client, GatewayIntentBits } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const logger = require('./utils/logger');
const dotenv = require('dotenv');
dotenv.config();

// Processus de démarrage du bot
async function startBot() {
  try {
    // Créer le client Discord
    const client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ] 
    });
    
    // Charger les commandes
    const { commands, commandsArray } = loadCommands(client);
    client.commandsArray = commandsArray;
    
    // Charger les événements
    loadEvents(client);
    
    // Gestion des erreurs non capturées
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Promesse rejetée non gérée', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Exception non capturée', error);
      // Normalement, il est conseillé de fermer le processus après une exception non capturée
      // Mais ici, nous allons continuer pour éviter un arrêt brutal du bot
    });
    
    // Connexion du bot
    await client.login(process.env.APP_TOKEN);
    
  } catch (error) {
    logger.error('Erreur de démarrage du bot', error);
    process.exit(1);
  }
}

// Démarrer le bot
startBot();