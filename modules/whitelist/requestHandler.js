const { ChannelType, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');
const messageUtils = require('../../utils/messageUtils');

// Créer un canal de demande de whitelist
async function createWhitelistChannel(client, interaction) {
  try {
    // Obtenir les informations sur l'utilisateur et la guilde
    const guild = interaction.guild;
    const user = interaction.user;

    // Récupérer la configuration du serveur
    const guildConfig = getGuildConfig(guild.id);
    if (!guildConfig) {
      logger.warning(`Configuration manquante pour le serveur ${guild.name}`);
      await interaction.reply({
        content: "❌ Erreur: Configuration du serveur manquante. Veuillez contacter un administrateur.",
        ephemeral: true
      });
      return;
    }

    // Récupérer le nom de la catégorie depuis la configuration
    const categoryName = guildConfig.categories?.newRequests || '🔍 Demande de Whitelist';

    // Générer un ID aléatoire de 5 caractères
    const randomId = Math.random().toString(36).substring(2, 7);
    
    // Nom du nouveau canal
    const channelName = `${randomId}-wl-${user.username}`;
    
    // Trouver ou créer la catégorie pour les nouvelles demandes
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === categoryName
    );
    
    // Si la catégorie n'existe pas, la créer
    if (!category) {
      logger.info(`Création de la catégorie "${categoryName}" sur ${guild.name}`);
      category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: guild.members.me.id, // Le bot
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
    }
    
    // Créer le canal avec les permissions appropriées
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: user.id, // L'utilisateur qui a cliqué
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: guild.members.me.id, // Le bot
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });
    
    // Répondre à l'interaction
    await interaction.reply({
      content: `Votre demande de whitelist a été créée dans le canal ${channel}`,
      ephemeral: true
    });
    
    // Envoyer un message dans le nouveau canal
    const welcomeEmbed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('🔍 Demande de Whitelist')
      .setDescription(`Bonjour ${user}, merci pour votre demande de whitelist!`)
      .addFields(
        { name: 'Instructions', value: 'Veuillez remplir le formulaire ci-dessous pour votre demande de whitelist.' }
      );
      
    // Créer un bouton pour le formulaire
    const formButton = new ButtonBuilder()
      .setCustomId('fill_form')
      .setLabel('Remplir le formulaire')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📝');
      
    const row = new ActionRowBuilder().addComponents(formButton);
    
    await channel.send({
      content: `<@${user.id}>, voici votre formulaire de demande de whitelist:`,
      embeds: [welcomeEmbed],
      components: [row]
    });
    
    logger.info(`Canal de demande de whitelist créé: ${channelName} pour l'utilisateur ${user.tag}`);
          
  } catch (error) {      
    logger.error(`Erreur lors de la création du canal de demande de whitelist`, error);
    
    // Informer l'utilisateur en cas d'erreur
    if (!interaction.replied) {
      await interaction.reply({
        content: "Désolé, une erreur s'est produite lors de la création de votre demande de whitelist. Veuillez réessayer plus tard.",
        ephemeral: true
      });
    }
  }
}

module.exports = {
  createWhitelistChannel
};