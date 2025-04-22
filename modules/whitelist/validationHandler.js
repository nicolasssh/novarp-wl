const { ChannelType, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getGuildConfig } = require('../../utils/configManager');
const logger = require('../../utils/logger');

// Gérer la validation/refus du formulaire de whitelist
async function handleFormValidation(client, interaction, isValidation) {
  try {
    // Récupérer l'ID de l'utilisateur concerné
    const userId = interaction.customId.split('_')[2];
    
    // Récupérer la configuration du serveur
    const guildConfig = getGuildConfig(interaction.guild.id);
    if (!guildConfig) {
      await interaction.reply({
        content: "❌ Erreur: Configuration du serveur manquante. Veuillez contacter un administrateur.",
        ephemeral: true
      });
      return;
    }
    
    if (!guildConfig.staffWlRoleId) {
      await interaction.reply({
        content: "❌ La configuration du rôle modérateur est manquante sur ce serveur.",
        ephemeral: true
      });
      return;
    }
    
    // Vérifier si l'utilisateur a le rôle requis
    const member = interaction.member;
    if (!member.roles.cache.has(guildConfig.staffWlRoleId)) {
      await interaction.reply({
        content: "❌ Vous n'avez pas la permission d'utiliser ce bouton. Seuls les modérateurs peuvent valider ou refuser les demandes.",
        ephemeral: true
      });
      return;
    }
    
    const action = isValidation ? "validée" : "refusée";
    const emoji = isValidation ? "✅" : "❌";
    const color = isValidation ? Colors.Green : Colors.Red;
    
    // Créer l'embed de réponse
    const responseEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} Demande ${action}`)
      .setDescription(`La demande de whitelist a été ${action} par <@${interaction.user.id}>.`)
      .setFooter({ text: `Modérateur: ${interaction.user.tag}` })
      .setTimestamp();
    
    // Mettre à jour le message avec le nouvel embed et retirer les boutons de validation/refus
    // Si c'est une validation, on va ajouter de nouveaux boutons pour l'entretien
    if (isValidation) {
      // Créer les boutons d'entretien
      const validateInterviewButton = new ButtonBuilder()
        .setCustomId(`validate_interview_${userId}`)
        .setLabel('Valider l\'entretien')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');
        
      const rejectInterviewButton = new ButtonBuilder()
        .setCustomId(`reject_interview_${userId}`)
        .setLabel('Refuser l\'entretien')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');
      
      const interviewButtonsRow = new ActionRowBuilder().addComponents(validateInterviewButton, rejectInterviewButton);
      
      await interaction.update({
        content: `<@${userId}>, votre demande de whitelist a été approuvée! 🎉 Un modérateur va maintenant procéder à l'entretien.`,
        components: [interviewButtonsRow],
        embeds: [responseEmbed]
      });
    } else {
      // Si c'est un refus, on retire tous les boutons
      await interaction.update({
        content: `<@${userId}>, votre demande de whitelist a été refusée.`,
        components: [],
        embeds: [responseEmbed]
      });
    }
    
    // Obtenir l'objet canal
    const channel = interaction.channel;
    
    // Récupérer les noms des catégories depuis la configuration
    const categoryApprovedName = guildConfig.categories?.approved || '✅ WL validée';
    const categoryRejectedName = guildConfig.categories?.rejected || '❌ WL refusée';
    
    if (isValidation) {
      // Si validé, déplacer vers la catégorie des demandes validées (à créer si nécessaire)
      let validatedCategory = interaction.guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === categoryApprovedName
      );
      
      if (!validatedCategory) {
        validatedCategory = await interaction.guild.channels.create({
          name: categoryApprovedName,
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: interaction.guild.id, // @everyone
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: interaction.guild.members.me.id, // Le bot
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }
          ]
        });
      }
      
      await channel.setParent(validatedCategory.id, { lockPermissions: false });
      
      // Envoyer un message de suivi
      await channel.send({
        content: `<@${userId}>, félicitations! Votre formulaire de whitelist a été validé. Un modérateur va maintenant procéder à l'entretien.`
      });
      
      // Trouver le membre et lui ajouter le rôle
      try {
        const userMember = await interaction.guild.members.fetch(userId);
        
        if (guildConfig.validRequestRoleId) {
          // Vérifier si le bot a la permission et si le rôle est accessible
          const botMember = interaction.guild.members.me;
          const roleToAdd = interaction.guild.roles.cache.get(guildConfig.validRequestRoleId);
          
          // Vérifier si le rôle existe
          if (!roleToAdd) {
            await channel.send({
              content: `⚠️ Erreur: Le rôle avec l'ID ${guildConfig.validRequestRoleId} n'existe pas.`
            });
            return;
          }
          
          // Vérifier la hiérarchie des rôles
          if (roleToAdd.position >= botMember.roles.highest.position) {
            await channel.send({
              content: `⚠️ Je ne peux pas attribuer le rôle ${roleToAdd.name} car il est placé plus haut ou au même niveau que mon rôle le plus élevé dans la hiérarchie du serveur.`
            });
            return;
          }
          
          await userMember.roles.add(guildConfig.validRequestRoleId);
          logger.info(`Rôle de validation ajouté à ${userMember.user.tag}`);
          
          await channel.send({
            content: `Le rôle <@&${guildConfig.validRequestRoleId}> a été attribué à <@${userId}>.`
          });
        } else {
          logger.warning(`Le rôle de validation n'est pas configuré pour le serveur ${interaction.guild.name}`);
          await channel.send({
            content: `⚠️ Attention : Le rôle de validation n'est pas configuré correctement. Veuillez contacter un administrateur.`
          });
        }
      } catch (error) {
        logger.error(`Erreur lors de l'ajout du rôle à l'utilisateur ${userId}`, error);
        await channel.send({
          content: `⚠️ Erreur lors de l'attribution du rôle à <@${userId}>. Détails: ${error.message || "Erreur inconnue"}. Veuillez vérifier que le rôle existe et que le bot a les permissions nécessaires.`
        });
      }
    } else {
      // Si refusé, déplacer vers une catégorie des demandes refusées (à créer si nécessaire)
      let rejectedCategory = interaction.guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === categoryRejectedName
      );
      
      if (!rejectedCategory) {
        rejectedCategory = await interaction.guild.channels.create({
          name: categoryRejectedName,
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: interaction.guild.id, // @everyone
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: interaction.guild.members.me.id, // Le bot
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }
          ]
        });
      }
      
      await channel.setParent(rejectedCategory.id, { lockPermissions: false });
      
      // Envoyer un message de suivi
      await channel.send({
        content: `<@${userId}>, désolé, votre demande de whitelist a été refusée. Vous pouvez contacter un modérateur pour en savoir plus.`
      });
    }
    
    logger.info(`Demande de whitelist ${action} pour l'utilisateur <@${userId}> par ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Erreur lors du traitement du bouton de validation/refus`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Désolé, une erreur s'est produite lors du traitement de votre action. Veuillez réessayer plus tard.",
        ephemeral: true
      });
    }
  }
}

module.exports = {
  handleFormValidation
};