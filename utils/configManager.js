const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// Créer un émetteur d'événements pour signaler les changements de configuration
const configEvents = new EventEmitter();

// Map pour suivre l'état de configuration
const configuredGuilds = new Map();

// Fonction pour vérifier si un serveur est configuré
function isGuildConfigured(guildId) {
  const configPath = path.join(__dirname, '..', 'config', `config_${guildId}.json`);
  return fs.existsSync(configPath);
}

// Fonction pour obtenir la configuration d'un serveur
function getGuildConfig(guildId) {
  const configPath = path.join(__dirname, '..', 'config', `config_${guildId}.json`);
  if (fs.existsSync(configPath)) {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error(`Erreur lors de la lecture de la configuration pour ${guildId}:`, error);
      return null;
    }
  }
  return null;
}

// Fonction pour définir l'état de configuration d'un serveur
function setGuildConfigured(guildId, configured = true) {
  const previousState = configuredGuilds.get(guildId) || false;
  
  // Mettre à jour l'état
  configuredGuilds.set(guildId, configured);
  
  // Si l'état a changé, émettre un événement
  if (previousState !== configured) {
    configEvents.emit('configChanged', guildId, configured);
    
    if (configured) {
      configEvents.emit('guildConfigured', guildId, getGuildConfig(guildId));
    } else {
      configEvents.emit('guildUnconfigured', guildId);
    }
  }
}

module.exports = {
  isGuildConfigured,
  getGuildConfig,
  setGuildConfigured,
  configEvents,
  configuredGuilds
};