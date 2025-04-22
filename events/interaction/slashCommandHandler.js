const { isGuildConfigured } = require('../../utils/configManager');
const logger = require('../../utils/logger');

module.exports = {
  execute(client, interaction) {
    // Ignorer si ce n'est pas une commande slash
    if (!interaction.isChatInputCommand()) return;
    
    const commandName = interaction.commandName;
    const command = client.commands.get(commandName);
    
    if (!command) return;
    
    // Vérifier la configuration sauf pour la commande config elle-même
    if (commandName !== 'config' && !isGuildConfigured(interaction.guild.id)) {
      return interaction.reply({
        content: '⚠️ Ce serveur n\'a pas encore été configuré. Veuillez utiliser la commande `/config` d\'abord.',
        ephemeral: true
      });
    }
    
    try {
      command.execute(interaction);
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la commande ${commandName}`, error);
      
      // Répondre à l'utilisateur
      try {
        const errorResponse = { 
          content: 'Une erreur est survenue lors de l\'exécution de cette commande!', 
          ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
          interaction.followUp(errorResponse);
        } else {
          interaction.reply(errorResponse);
        }
      } catch (replyError) {
        logger.error(`Erreur lors de la réponse à l'erreur de commande`, replyError);
      }
    }
  }
};