const { Events, EmbedBuilder, Colors, PermissionsBitField } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const logger = require('../../utils/logger');

module.exports = {
  name: Events.GuildCreate,
  once: false,
  async execute(client, guild) {
    logger.info(`Bot ajouté au serveur: ${guild.name} (${guild.id})`);
    
    // Vérifier les permissions du bot dans ce serveur
    const me = guild.members.me;
    if (!me) {
      logger.error(`Impossible de récupérer l'objet membre du bot sur ${guild.name}`);
      return;
    }
      
    // Déployer les commandes sur ce nouveau serveur
    const rest = new REST().setToken(process.env.APP_TOKEN);
    const commandsJSON = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    
    try {
      logger.info(`Déploiement des commandes pour le serveur ${guild.id}`);
      
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
        { body: commandsJSON }
      );
      
      logger.info(`${commandsJSON.length} commandes déployées avec succès sur ${guild.id}`);
    } catch (error) {
      logger.error(`Erreur lors du déploiement des commandes sur ${guild.id}`, error);
      return;
    }
    
    // Envoyer un message d'accueil
    try {
      // Trouver un canal où le bot peut envoyer des messages
      
      const systemChannel = guild.systemChannel;
      const generalChannel = guild.channels.cache.find(channel => 
        (channel.name.includes('général') || channel.name.includes('general')) && channel.isTextBased()
      );
      const firstTextChannel = guild.channels.cache.find(channel => channel.isTextBased());
      
      // Utiliser le premier canal disponible dans cet ordre
      const targetChannel = systemChannel || generalChannel || firstTextChannel;
      
      if (targetChannel) {      
        // Vérifier les permissions dans ce canal
        const permissions = targetChannel.permissionsFor(me);
        if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
          logger.warning(`Pas de permission d'envoi de messages dans ${targetChannel.name} sur ${guild.name}`);
          return;
        }
        
        const welcomeEmbed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('👋 Bonjour!')
          .setDescription(`Merci de m'avoir ajouté à votre serveur **${guild.name}**!`)
          .addFields(
            { name: '🔧 Configuration', value: 'Maintenant configurons le module avec la commande `/config`' }
          )
          .setFooter({ text: 'Merci de votre confiance!' })
          .setTimestamp();
        
        // Envoyer l'embed
        await targetChannel.send({ embeds: [welcomeEmbed] });
      } else {
        logger.warning(`Aucun canal trouvé pour envoyer le message d'accueil sur ${guild.name}`);
      }
    } catch (error) {
      logger.error(`Erreur lors de l'envoi du message d'accueil sur ${guild.name}`, error);
    }
  }
};