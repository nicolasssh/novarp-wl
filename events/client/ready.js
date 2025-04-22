const { Events } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { isGuildConfigured, configuredGuilds } = require('../../utils/configManager');
const logger = require('../../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Connecté en tant que ${client.user.tag}`);
    
    // Déployer les commandes sur tous les serveurs existants
    const guilds = client.guilds.cache;
    const rest = new REST().setToken(process.env.APP_TOKEN);
    
    const commandsJSON = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    
    for (const guild of guilds.values()) {
      try {
        logger.info(`Déploiement des commandes pour le serveur ${guild.name} (${guild.id})`);
        
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
          { body: commandsJSON }
        );
        
        const configured = isGuildConfigured(guild.id);
        configuredGuilds.set(guild.id, configured);
        
        // Log des permissions du bot sur ce serveur
        const me = guild.members.me;
        if (me) {
          logger.info(`Permissions sur ${guild.name}: ${me.permissions.toArray().join(', ')}`);
        }
      } catch (error) {
        logger.error(`Erreur lors du déploiement des commandes sur ${guild.name}`, error);
      }
    }
    
    logger.info(`Bot prêt avec ${client.commands.size} commandes chargées`);
  }
};