const { EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');

// Traiter le statut légal/illégal
async function processLegalStatus(client, interaction, userId) {
  try {
    // Vérifier si c'est bien l'utilisateur concerné qui répond
    if (userId !== interaction.user.id) {
      await interaction.reply({
        content: "Ce menu ne vous est pas destiné.",
        ephemeral: true
      });
      return;
    }
    
    // Récupérer le choix légal/illégal
    const legalStatus = interaction.values[0]; // 'legal' ou 'illegal'
    
    // Récupérer les données du formulaire stockées précédemment
    if (!client.formData || !client.formData.has(userId)) {
      await interaction.reply({
        content: "Désolé, vos données de formulaire n'ont pas été trouvées. Veuillez réessayer.",
        ephemeral: true
      });
      return;
    }
    
    const formData = client.formData.get(userId);
    // Ajouter le statut légal aux données
    formData.legalStatus = legalStatus;
    
    // Récupérer la configuration du serveur
    const guildConfig = getGuildConfig(interaction.guild.id);
    if (!guildConfig) {
      logger.warning(`Configuration manquante pour le serveur ${interaction.guild.name}`);
      await interaction.reply({
        content: "❌ Erreur: Configuration du serveur manquante. Veuillez contacter un administrateur.",
        ephemeral: true
      });
      return;
    }
    
    // Créer l'embed pour afficher les réponses
    const responseEmbed = new EmbedBuilder()
      .setColor(legalStatus === 'legal' ? Colors.Green : Colors.Red)
      .setTitle('📝 Formulaire de Whitelist soumis')
      .addFields(
        { name: 'Nom', value: formData.nom, inline: true },
        { name: 'Prénom', value: formData.prenom, inline: true },
        { name: 'Statut', value: legalStatus === 'legal' ? '✅ Légal' : '🚫 Illégal', inline: true },
        { name: 'Background', value: `[Lien vers le background](${formData.backgroundLink})` }
      )
      .setFooter({ text: `Demande soumise par ${interaction.user.tag}` })
      .setTimestamp();
    
    // Vérifier que le rôle de validation existe
    if (!guildConfig.staffWlRoleId) {
      logger.warning(`Configuration du rôle modérateur manquante pour le serveur ${interaction.guild.name}`);
    }
    
    // Créer les boutons de validation/refus
    const validateButton = new ButtonBuilder()
      .setCustomId(`validate_wl_${userId}`)
      .setLabel('Valider')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');
      
    const rejectButton = new ButtonBuilder()
      .setCustomId(`reject_wl_${userId}`)
      .setLabel('Refuser')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌');
    
    const buttonsRow = new ActionRowBuilder().addComponents(validateButton, rejectButton);
    
    // Envoyer l'embed dans le canal avec les boutons
    await interaction.update({ 
      content: `<@${userId}>, votre formulaire a été soumis avec succès! Un modérateur va l'examiner prochainement.`,
      components: [buttonsRow],
      embeds: [responseEmbed]
    });
    
    // Obtenir l'objet canal
    const channel = interaction.channel;
    const guild = interaction.guild;
    
    // Récupérer le nom de la catégorie depuis la configuration
    const categoryPendingName = guildConfig.categories?.pending || '⏳ WL en attente de validation';
    
    // Créer ou trouver la catégorie "En attente de validation"
    let waitingCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === categoryPendingName
    );
    
    if (!waitingCategory) {
      waitingCategory = await guild.channels.create({
        name: categoryPendingName,
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
    
    // Déplacer le canal vers la nouvelle catégorie
    await channel.setParent(waitingCategory.id, { 
      lockPermissions: false // Ne pas synchroniser les permissions avec la catégorie
    });
    
    // Supprimer les données temporaires
    client.formData.delete(userId);
    
    logger.info(`Formulaire de whitelist soumis par ${interaction.user.tag} dans ${channel.name}`);
    
  } catch (error) {
    logger.error(`Erreur lors du traitement de la sélection légal/illégal`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Désolé, une erreur s'est produite lors du traitement de votre sélection. Veuillez réessayer plus tard.",
        ephemeral: true
      });
    }
  }
}

module.exports = {
  processLegalStatus
};