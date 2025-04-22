const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');
const { configEvents } = require('../../utils/configManager');
const logger = require('../../utils/logger');

module.exports = {
  name: 'ready', // Nous utilisons l'événement ready pour mettre en place l'écouteur d'événement
  once: true,
  async execute(client) {
    // Configurer l'écouteur d'événement pour guildConfigured
    configEvents.on('guildConfigured', async (guildId, config) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warning(`Événement guildConfigured reçu pour un serveur inconnu: ${guildId}`);
        return;
      }
      logger.info(`Configuration terminée pour le serveur ${guild.name} (${guildId})`);
        
      try {
        if (!config) {
          logger.warning(`Configuration manquante pour le serveur ${guild.name}`);
          return;
        }
        logger.info(`Configuration: ${JSON.stringify(config)}`);
            
        const requestChannelId = config.requestChannelId;
        if (!requestChannelId) {
          logger.warning(`ID de canal manquant dans la configuration de ${guild.name}`);
          return;
        }
        
        const channel = guild.channels.cache.get(requestChannelId);
        if (!channel) {
          logger.warning(`Canal ${requestChannelId} non trouvé sur ${guild.name}`);
          return;
        }
        logger.info(`Canal de requêtes configuré: ${channel.name} (${channel.id})`);
            
        // Vérifier les permissions avant d'envoyer
        const me = guild.members.me;
        if (!me) {
          logger.error(`Impossible de récupérer l'objet membre du bot sur ${guild.name}`);
          return;
        }
        
        const permissions = channel.permissionsFor(me);
        logger.info(`Permissions du bot dans le canal ${channel.name}: ${permissions.toArray().join(', ')}`);
        
        if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
          logger.warning(`Le bot n'a pas la permission d'envoyer des messages dans le canal ${channel.name}`);
          
          // Tenter de trouver un canal alternatif pour informer l'utilisateur
          const fallbackChannel = guild.channels.cache.find(c => 
            c.isTextBased() && c.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages)
          );
          
          if (fallbackChannel) {
            logger.info(`Envoi d'un message d'avertissement dans le canal alternatif: ${fallbackChannel.name}`);
            await fallbackChannel.send({
              content: `⚠️ Je n'ai pas la permission d'envoyer des messages dans le canal <#${channel.id}> que vous avez configuré. Veuillez vérifier mes permissions.`
            });
          }
          return;
        }
        
        const configSuccessEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('✅ Demandez votre whitelist')
            .setDescription('Cliquez sur le bouton ci-dessous pour faire une demande de whitelist')
            .addFields(
                { name: 'Remplissez le formulaire', value: `Remplissez le formulaire qui vos sera envoyer dans votre channel !` },
                { name: 'Attendez une validation', value: `Un douanier validera votre formulaire.` },
                { name: 'Passez l\'entretien', value: 'Une fois le formulaire validé, passez un entretien avec un douanier pour avoir votre whitelist !' }
            );

        // Créer un bouton
        const guideButton = new ButtonBuilder()
            .setCustomId('request_wl')
            .setLabel('Demandez votre whitelist')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅');

        // Créer une ligne pour les boutons
        const row = new ActionRowBuilder().addComponents(guideButton);

        // Envoyer le message avec l'embed et le bouton
        await channel.send({
            embeds: [configSuccessEmbed],
            components: [row]
        });
        logger.info(`Message de confirmation envoyé dans ${channel.name} sur ${guild.name}`);
        
      } catch (error) {
        logger.error(`Erreur lors des actions post-configuration pour ${guild?.name || guildId}`, error);
      }
    });
  }
};