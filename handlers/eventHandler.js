const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

// Fonction pour charger les événements
function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  
  if (!fs.existsSync(eventsPath)) {
    logger.error("Le dossier d'événements est introuvable.");
    return;
  }
  
  // Charger les événements client
  const clientEventsPath = path.join(eventsPath, 'client');
  if (fs.existsSync(clientEventsPath)) {
    const eventFiles = fs.readdirSync(clientEventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
      const filePath = path.join(clientEventsPath, file);
      
      try {
        const event = require(filePath);
        if (event.once) {
          client.once(event.name, (...args) => event.execute(client, ...args));
        } else {
          client.on(event.name, (...args) => event.execute(client, ...args));
        }
        logger.info(`Événement client chargé: ${event.name}`);
      } catch (error) {
        logger.error(`Erreur lors du chargement de l'événement ${filePath}`, error);
      }
    }
  }
  
  // Charger les événements d'interaction
  const interactionEventsPath = path.join(eventsPath, 'interaction');
  if (fs.existsSync(interactionEventsPath)) {
    const eventFiles = fs.readdirSync(interactionEventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
      const filePath = path.join(interactionEventsPath, file);
      
      try {
        const event = require(filePath);
        client.on('interactionCreate', (interaction) => event.execute(client, interaction));
        logger.info(`Gestionnaire d'interaction chargé: ${file}`);
      } catch (error) {
        logger.error(`Erreur lors du chargement du gestionnaire d'interaction ${filePath}`, error);
      }
    }
  }
}

module.exports = { loadEvents };